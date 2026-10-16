import type { ZoneId } from '@domain/types'
import type { TileKind } from './terrains'

/**
 * The scrap-yard world plan, as data: where the zones sit, and every patch, pond
 * and road link that dresses the ground between them. It lives in the pack — not
 * in the UI — because the pack is what paints the map; `ui` reads it back for the
 * camera, couriers and HUD, so a pack never reaches up into the game.
 *
 * The world is a **work world**: a compact industrial core (the five chain zones
 * plus the harvest fields around them) sits on a full-width avenue, and the rest
 * is wilderness — forests, ponds, a lake, plateaus — to explore. Zones keep their
 * authored size; growth goes into open ground.
 *
 * Design-space grid: the art is authored at double density (1 design px has
 * become the finest feature step), so the canvas maps 1:1 and every object
 * carries twice the pixels it used to.
 */
export const WORLD_WIDTH = 10240
export const WORLD_HEIGHT = 5760

/** The avenue (the old road band, now the map's spine): asphalt, full width. */
export const AVENUE_Y = 2848
export const AVENUE_HEIGHT = 64

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
 * Zones keep their authored size and their RELATIVE arrangement (which lanes and
 * fence openings connect which edges) — the core simply moved onto the avenue.
 */
export const ZONE_LAYOUTS: Record<string, ZoneLayout> = {
  alley: {
    style: { color: 0x7cc45c, css: '#7cc45c' },
    // Bãi rác lớn: 21×17 ô, bắc-tây lõi. Cạnh vẫn bám lưới 16 để lớp sàn vẽ ở toạ
    // độ local của khu trùng lưới tile với bản đồ.
    rect: { x: 3904, y: 2144, width: 336, height: 272 },
    // Cổng nam: làn đất khu → đại lộ rộng 72px cắt qua cạnh nam (world x 4062..4134),
    // và lối mòn đất sang xưởng tái chế ở cạnh đông (world y 2196..2244).
    fenceOpenings: [
      { edge: 'south', from: 158, to: 230 },
      { edge: 'east', from: 52, to: 100 },
    ],
  },
  recycle: {
    style: { color: 0xd08a4a, css: '#d08a4a' },
    // Xưởng tái chế: 16.5×11 ô, đông-bắc lõi; làn nhựa nam của nó chạy thẳng xuống
    // đại lộ và đổ ĐÚNG chỗ chồng phôi của khu `route` (world x 5236).
    rect: { x: 5120, y: 2104, width: 264, height: 176 },
    fenceOpenings: [
      { edge: 'west', from: 92, to: 140 },
      { edge: 'south', from: 92, to: 140 },
    ],
  },
  route: {
    style: { color: 0xffb454, css: '#ffb454' },
    // Đại lộ chạy hết map; khu `route` là một ĐOẠN của nó quanh lõi, nơi chồng
    // phôi (local 724) ngồi ngay ngã ba làn xưởng đổ xuống.
    rect: { x: 4512, y: AVENUE_Y, width: 1280, height: AVENUE_HEIGHT },
  },
  depot: {
    style: { color: 0x7fa4d9, css: '#7fa4d9' },
    // Kho: nam-tây lõi, dưới bãi ve chai. Cổng kho: lối đi đất vào nhà cắt qua
    // cạnh bắc (world x 4052..4128); làn nhựa driveway nằm gọn trong lỗ mở đó.
    rect: { x: 3936, y: 3028, width: 264, height: 88 },
    fenceOpenings: [{ edge: 'north', from: 116, to: 192 }],
  },
  gate: {
    style: { color: 0xf08a6a, css: '#f08a6a' },
    // Cổng xuất: nam-đông lõi, sát đại lộ. Làn nhựa vào cổng ở cạnh bắc
    // (world x 6324..6360); làn xuất hàng ở cạnh đông (world y 3044..3080) rồi
    // chạy tiếp ra ngã ba nhập làn với đại lộ.
    rect: { x: 6260, y: 3016, width: 256, height: 92 },
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
 * Asphalt links between zones (driveways up from the avenue, the forge lane and
 * the export lane east of the gate, plus the merge ramp back onto the avenue).
 * Painted from here so the map and the studio show the exact same connections.
 */
export const FORGE_LANE: ZoneRect = { x: 5212, y: 2280, width: 48, height: 568 }
export const DEPOT_DRIVEWAY: ZoneRect = { x: 4072, y: 2912, width: 36, height: 116 }
export const GATE_DRIVEWAY: ZoneRect = { x: 6324, y: 2912, width: 36, height: 104 }
export const GATE_EXIT_LANE: ZoneRect = { x: 6516, y: 3044, width: 680, height: 32 }
export const EXIT_MERGE_RAMP: ZoneRect = { x: 7164, y: 2912, width: 32, height: 132 }

export const CONNECTORS: readonly ZoneRect[] = [
  // Làn nhựa xưởng tái chế → đại lộ (world x 5212..5260), từ mép nam xưởng (2280)
  // xuống mặt đường (2848).
  FORGE_LANE,
  // Driveway kho: từ đại lộ (2912) xuống cổng bắc kho (3028).
  DEPOT_DRIVEWAY,
  // Driveway cổng xuất: từ đại lộ (2912) xuống cổng bắc cổng (3016).
  GATE_DRIVEWAY,
  // Làn xuất hàng: từ cổng đông (6516) chạy về đông tới ngã ba nhập làn.
  GATE_EXIT_LANE,
  // Ngã ba nhập làn: nối làn xuất hàng trở lên đại lộ (nơi xe tải "ra khỏi thành phố").
  EXIT_MERGE_RAMP,
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
 * Ground patches on the open map. Around the core they are the **harvest fields**
 * (scrap fields, the gravel pit, the wallow host); away from it they are the
 * wilderness features (plateaus, forest floors, a lakeside bank). Elevation > 0
 * makes a plateau: its influence box must stay clear of every zone, connector and
 * courier path (see the layout test).
 */
export const CLEARINGS: readonly PatchArea[] = [
  // --- harvest fields around the core -----------------------------------------
  // Bãi phế liệu tây-bắc (điểm khai thác: đống ve chai rải trong bãi).
  { rect: { x: 3300, y: 1640, width: 300, height: 200 } },
  // Bãi phế liệu đông-bắc.
  { rect: { x: 6500, y: 1700, width: 300, height: 210 } },
  // Bãi phế liệu đông-nam.
  { rect: { x: 6300, y: 3450, width: 320, height: 230 } },
  // Mỏ sỏi: mảng đất có một mỏ sỏi nhô lên (demo cặp sỏi ↔ đất + bậc cao).
  { rect: { x: 3500, y: 3480, width: 300, height: 230 } },
  {
    rect: { x: 3650, y: 3580, width: 66, height: 40 },
    kind: 'gravel',
    outside: 'dirt',
    elevation: 1,
  },
  // Vũng bùn: ao bùn nằm trọn trong mảng đất (demo cặp nước ↔ đất).
  { rect: { x: 2000, y: 1400, width: 260, height: 190 } },
  // --- wilderness --------------------------------------------------------------
  // Gò đất cao giữa rừng tây.
  { rect: { x: 2500, y: 2200, width: 140, height: 90 }, elevation: 1 },
  // Đồi đá hai bậc ở đông bắc.
  { rect: { x: 7600, y: 2300, width: 180, height: 120 }, elevation: 2 },
  // Gò nam rừng.
  { rect: { x: 5200, y: 4300, width: 200, height: 140 }, elevation: 1 },
  // Bãi đất trống ven hồ tây.
  { rect: { x: 1500, y: 3700, width: 240, height: 170 } },
  // Nền rừng đông-nam.
  { rect: { x: 8500, y: 4200, width: 240, height: 180 } },
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
 * Standing water on the map: the west lake, ponds in the fields and forest, and
 * the mud wallow dug into its dirt patch. Painted as organic water blobs — full
 * autotile shore, foam, floating junk and water plants — not as flat ellipses.
 */
export const WATER_AREAS: readonly WaterArea[] = [
  // Hồ tây — vùng nước lớn nhất map.
  { rect: { x: 1200, y: 2950, width: 900, height: 560 } },
  // Ao bắc trong bãi cỏ.
  { rect: { x: 2600, y: 900, width: 220, height: 140 } },
  // Ao đông-bắc.
  { rect: { x: 6600, y: 800, width: 170, height: 110 } },
  // Ao đông trong rừng.
  { rect: { x: 8600, y: 1500, width: 200, height: 130 } },
  // Ao nam.
  { rect: { x: 4800, y: 4600, width: 240, height: 150 } },
  // Ao tây-nam.
  { rect: { x: 2800, y: 4300, width: 190, height: 120 } },
  // Hai ao nhỏ ngay bắc lõi (hồi nước cho khu ve chai/xưởng).
  { rect: { x: 4380, y: 1700, width: 150, height: 90 } },
  { rect: { x: 4760, y: 1620, width: 96, height: 64 } },
  // Vũng bùn trong mảng đất tây-bắc.
  { rect: { x: 2040, y: 1440, width: 130, height: 80 }, outside: 'dirt' },
]
