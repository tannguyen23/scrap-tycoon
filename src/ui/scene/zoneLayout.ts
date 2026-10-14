import type { ZoneId } from '@domain/types'
import type { TileKind } from '@ground/packs/scrapYard/terrains'

/**
 * Design-space grid. The art is authored at double density (1 design px has
 * become the finest feature step), so the canvas maps 1:1 and every object
 * carries twice the pixels it used to.
 */
export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

export const CANVAS_SCALE = 1
export const VIEW_WIDTH = WORLD_WIDTH * CANVAS_SCALE
export const VIEW_HEIGHT = WORLD_HEIGHT * CANVAS_SCALE

export interface ZoneRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ZoneStyle {
  /** Pixi fill colour. */
  color: number
  /** Matching CSS colour for the HUD zone cards. */
  css: string
}

/** Lỗ mở trên hàng rào bao khu — chỗ làn xe/lối đi cắt qua một cạnh của khu. */
export interface FenceOpening {
  /** Cạnh của khu bị cắt qua. */
  edge: 'north' | 'east' | 'south' | 'west'
  /** Toạ độ LOCAL dọc theo cạnh (x cho cạnh bắc/nam, y cho cạnh đông/tây). */
  from: number
  to: number
}

export interface ZoneLayout {
  rect: ZoneRect
  style: ZoneStyle
  /**
   * Hàng rào quanh khu do chính scene chi tiết của khu vẽ (để cả map lẫn tab Khu
   * trong studio đều thấy). Ở đây chỉ khai LỖ MỞ: làn đất/làn nhựa cắt qua cạnh nào
   * thì mở cổng đúng khổ làn đó, hai bên dựng trụ cổng. Khu `route` là đường chạy
   * ngang map nên không rào, không khai gì.
   */
  fenceOpenings?: readonly FenceOpening[]
}

export const DEFAULT_ZONE_STYLE: ZoneStyle = { color: 0x8b93a7, css: '#8b93a7' }

/**
 * Map layout for the scrap-yard zones (design space). Keyed by the same zone
 * ids content uses; each zone's detail scene is authored for exactly this rect.
 * Zones keep their authored size — the roomier map goes into the open ground
 * between them (clearings, ponds, tree lines).
 */
export const ZONE_LAYOUTS: Record<string, ZoneLayout> = {
  alley: {
    style: { color: 0x7cc45c, css: '#7cc45c' },
    // Bãi rác lớn: 21×17 ô. Trần kích thước là blob sàn chứ không phải rect — blob
    // nở thêm pad 24 rồi cộng đợt sóng (~17% bán kính với mảng cỡ này), nên mép
    // phải chừa ~40px mỗi bên: bên phải là bãi đất cao (blob tới x≈464) và ao nhỏ
    // đã dời sang (490,210), bên trái là mép canvas. Cạnh vẫn bám lưới 16 để lớp
    // sàn vẽ ở toạ độ local của khu trùng lưới tile với bản đồ.
    rect: { x: 48, y: 48, width: 336, height: 272 },
    // Cổng nam: làn đất khu → đường rộng 72px cắt qua cạnh nam (world x 206..278),
    // và lối mòn đất sang xưởng tái chế ở cạnh đông (world y 100..148).
    fenceOpenings: [
      { edge: 'south', from: 158, to: 230 },
      { edge: 'east', from: 52, to: 100 },
    ],
  },
  recycle: {
    style: { color: 0xd08a4a, css: '#d08a4a' },
    // Xưởng tái chế: 16.5×11 ô ở khoảng trống phía bắc giữa map — chặng nối giữa
    // khu ve chai (tây-bắc) và nơi đóng hàng (nam-tây). Cạnh bắc chừa 8px để rào
    // không chạm mép canvas; cạnh nam (y 184) chừa 196px xuống mặt đường.
    rect: { x: 608, y: 8, width: 264, height: 176 },
    // Hai cổng: lối mòn đất từ khu ve chai (world y 100..148) ở cạnh tây, làn nhựa ra
    // tuyến ba gác (world x 700..748) ở cạnh nam.
    fenceOpenings: [
      { edge: 'west', from: 92, to: 140 },
      { edge: 'south', from: 92, to: 140 },
    ],
  },
  route: {
    style: { color: 0xffb454, css: '#ffb454' },
    rect: { x: 0, y: 380, width: WORLD_WIDTH, height: 64 },
  },
  depot: {
    style: { color: 0x7fa4d9, css: '#7fa4d9' },
    rect: { x: 80, y: 560, width: 264, height: 88 },
    // Cổng kho: lối đi đất vào nhà (world x 196..272) cắt qua cạnh bắc; làn nhựa
    // 216..252 nằm gọn trong lỗ mở đó.
    fenceOpenings: [{ edge: 'north', from: 116, to: 192 }],
  },
  gate: {
    style: { color: 0xf08a6a, css: '#f08a6a' },
    rect: { x: 860, y: 548, width: 256, height: 92 },
    // Hai cổng: làn nhựa vào cổng (world x 924..960) ở cạnh bắc, làn xuất hàng
    // (world y 576..608) ở cạnh đông — mở tới y 612 để không cắt mặt nhựa trong sân.
    fenceOpenings: [
      { edge: 'north', from: 64, to: 100 },
      { edge: 'east', from: 28, to: 64 },
    ],
  },
}

export function zoneStyle(zoneId: ZoneId): ZoneStyle {
  return ZONE_LAYOUTS[zoneId]?.style ?? DEFAULT_ZONE_STYLE
}

/** True khi (x, y) rơi vào một trong các rect — dùng cho vùng cấm của lớp rải random. */
export function insideAnyRect(rects: readonly ZoneRect[], x: number, y: number): boolean {
  for (const rect of rects) {
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return true
  }
  return false
}

/**
 * Asphalt links between zones (driveways down to the yard + the gate exit lane).
 * Painted from here so the map and the studio show the exact same connections.
 */
export const CONNECTORS: readonly ZoneRect[] = [
  { x: 216, y: 444, width: 36, height: 116 },
  { x: 924, y: 444, width: 36, height: 104 },
  { x: 1116, y: 576, width: 164, height: 32 },
  // Làn nhựa xưởng tái chế → tuyến ba gác (world x 700..748), chạy từ mép nam
  // của xưởng (y 184) xuống mặt đường (y 380).
  { x: 700, y: 184, width: 48, height: 196 },
]

export interface PatchArea {
  rect: ZoneRect
  /** Terrain of the patch (default dirt). */
  kind?: TileKind
  /** Terrain it sits in — drives the lip of its edge tiles (default grass). */
  outside?: TileKind
  /**
   * >0 makes the patch a raised plateau: its edges become walls (sunlit crest,
   * wall face with strata, shadow cast onto the lower ground). Visual only.
   */
  elevation?: number
}

/**
 * Ground patches on the open map: the raised dirt mound (the elevation demo,
 * parked in the open grass — its blob + wall band must stay clear of every
 * courier walkway, see the layout test), the muddy wallow around a pond, the
 * gravel heap dug into one of the dirt clearings and a second raised heap.
 */
export const CLEARINGS: readonly PatchArea[] = [
  { rect: { x: 845, y: 292, width: 90, height: 44 }, elevation: 1 },
  { rect: { x: 1030, y: 300, width: 130, height: 80 } },
  { rect: { x: 620, y: 470, width: 100, height: 60 } },
  { rect: { x: 960, y: 620, width: 90, height: 54 } },
  { rect: { x: 418, y: 468, width: 172, height: 128 } },
  { rect: { x: 1062, y: 320, width: 66, height: 40 }, kind: 'gravel', outside: 'dirt', elevation: 1 },
]

export interface WaterArea {
  rect: ZoneRect
  /**
   * Terrain the pond sits in — drives its shore: grass lip in the fields, packed
   * mud where a wallow is dug into dirt (the water↔dirt transition pair).
   */
  outside?: TileKind
}

/**
 * Standing water on the map: rain ponds, a mud wallow dug into a dirt patch and
 * one at the gate. Painted as organic water blobs — full autotile shore, foam,
 * reeds, floating junk and water plants — not as flat ellipses.
 */
export const WATER_AREAS: readonly WaterArea[] = [
  { rect: { x: 880, y: 120, width: 170, height: 100 } },
  { rect: { x: 560, y: 240, width: 108, height: 66 } },
  { rect: { x: 490, y: 210, width: 70, height: 44 } },
  { rect: { x: 440, y: 500, width: 120, height: 70 }, outside: 'dirt' },
  { rect: { x: 700, y: 610, width: 76, height: 46 } },
]