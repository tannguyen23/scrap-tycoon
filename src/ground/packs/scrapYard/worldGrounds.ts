import { Graphics, type Container } from 'pixi.js'
import type { TilePainter } from '@ground/core/painter'
import { paintGrounds, scatterSkipRects, type GroundMap } from '@ground/core/grounds'
import type { Rect } from '@ground/core/metrics'
import { drawDecor } from './decorPlacements'
import { SCRAP_YARD_PACK } from './pack'
import {
  AVENUE_HEIGHT,
  AVENUE_Y,
  CLEARINGS,
  CONNECTORS,
  WATER_AREAS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
} from './worldLayout'

/** Sàn khu lấy ĐÚNG rect của layout — chép tay hai nơi là mầm lệch sàn. */
function zoneRect(id: string): Rect {
  const layout = ZONE_LAYOUTS[id]
  if (!layout) throw new Error(`missing zone layout "${id}"`)
  return layout.rect
}

/**
 * The scrap-yard ground plan, as data. Order and seeds are the map's tuned
 * look — the kit's `paintGrounds` runs the passes; this file only says what and
 * where. `lanes` are painted before the floors (their mouths tuck under them);
 * `traces` after, so the worn lines run right up to the gates.
 */
export const SCRAP_MAP: GroundMap = {
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  base: 'grass',
  baseSeed: 7,
  patchworkSeed: 31,
  floraSeed: 41,
  lanes: [
    // Đại lộ chạy hết map: xương sống của thế giới, hai mép thẳng (đường trong
    // pixel art vốn thẳng). Khu `route` là một đoạn của chính dải này — scene của
    // khu vẽ mặt nhựa riêng đè lên, nên ở đây cứ phủ liền một mạch.
    {
      rect: { x: 0, y: AVENUE_Y, width: WORLD_WIDTH, height: AVENUE_HEIGHT },
      kind: 'asphalt',
      seed: 15,
      outside: 'grass',
    },
    // Đường đất nối khu ve chai xuống đại lộ: làn 72px rộng ĐỀU, chỉ loe ở ĐẦU BÃI
    // (`mouths: 'top'`); đầu dưới kết thúc ĐÚNG mép đại lộ (y 2848).
    {
      rect: { x: 4062, y: 2246, width: 72, height: 602 },
      kind: 'dirt',
      seed: 12,
      outside: 'grass',
      flare: 44,
      ramp: 50,
      mouths: 'top',
      jitter: 6,
    },
    // Lối mòn đất khu ve chai → xưởng tái chế: làn 48px từ mép đông khu (x 4240)
    // sang mép tây xưởng (x 5120), không loe vì hai đầu cắm vào sàn khu. Wobble 8px
    // cho hai mép dài bước theo lưới ô như mọi mảng đất khác.
    { rect: { x: 4240, y: 2196, width: 880, height: 48 }, kind: 'dirt', seed: 17, outside: 'grass', jitter: 8 },
  ],
  floors: [
    { rect: zoneRect('alley'), kind: 'dirt', seed: 11, pad: 24 },
    { rect: zoneRect('recycle'), kind: 'dirt', seed: 16, pad: 24 },
    { rect: zoneRect('depot'), kind: 'dirt', seed: 13, pad: 24 },
    { rect: zoneRect('gate'), kind: 'gravel', seed: 14, pad: 28 },
  ],
  clearings: CLEARINGS.map((patch, index) => ({
    rect: patch.rect,
    seed: 18 + index,
    kind: patch.kind,
    outside: patch.outside,
    elevation: patch.elevation,
  })),
  traces: [
    // Vết sử dụng trên hai làn đất: porter/courier đi dọc làn ve chai→xưởng suốt
    // ngày nên giữa làn mòn thành vệt + vết chân; làn xuống đại lộ là lối người/ba
    // gác nên có vệt mòn + rãnh bánh.
    { kind: 'wear', points: [{ x: 4248, y: 2220 }, { x: 5112, y: 2220 }], seed: 137, strength: 0.85 },
    { kind: 'footprints', points: [{ x: 4252, y: 2219 }, { x: 5108, y: 2221 }], seed: 138, strength: 0.9 },
    { kind: 'wear', points: [{ x: 4098, y: 2254 }, { x: 4098, y: 2842 }], seed: 139, strength: 0.7 },
    { kind: 'ruts', points: [{ x: 4090, y: 2262 }, { x: 4090, y: 2836 }], seed: 140, strength: 0.55 },
  ],
  connectors: { rects: CONNECTORS, kind: 'asphalt', seedBase: 15 },
  links: [
    // CHỖ NỐI: `outside` phải là nền THẬT xung quanh (a) lối vào kho nằm trong bãi
    // đất của kho nên môi là ĐẤT; (b)(c) hai lối vào sân cổng nằm trong bãi sỏi.
    {
      rect: { x: 4052, y: 2966, width: 76, height: 88 },
      kind: 'dirt',
      seed: 33,
      outside: 'dirt',
      flare: 30,
      ramp: 34,
      jitter: 5,
    },
    { rect: { x: 6300, y: 2966, width: 84, height: 84 }, kind: 'gravel', seed: 34, outside: 'gravel', flare: 30, ramp: 32 },
    { rect: { x: 6486, y: 3036, width: 72, height: 50 }, kind: 'gravel', seed: 35, outside: 'gravel', flare: 24, ramp: 22 },
  ],
  debrisSeed: 42,
  water: WATER_AREAS.map((area, index) => ({
    rect: area.rect,
    seed: 21 + index * 3,
    kind: 'water',
    outside: area.outside,
  })),
  // Khu `route` là dải nhựa phủ kín rect nên chỉ cần đúng rect làm vùng cấm rải.
  scatterSkip: [zoneRect('route')],
  decor: drawDecor,
}

/**
 * Paints the scrap-yard map with its own pack. Shared by the game scene and the
 * asset studio so both always show the same world. `window` restricts the pass to
 * a rect (the scene chunks by it; the studio previews one district at a time).
 */
export function paintWorldGrounds(
  painter: TilePainter,
  ground: Container,
  decor: Graphics,
  window?: Rect,
): void {
  paintGrounds(SCRAP_YARD_PACK, SCRAP_MAP, painter, ground, decor, window)
}

/**
 * Vùng cấm của mọi lớp rải random trên nền map: lòng khu + vành blob sàn. Sàn nở
 * ra `pad` nên hoa cỏ mọc sát mép khu bị sàn che nửa — đọc ra như "cây mọc trong
 * bãi". Test bất biến layout đọc chính danh sách này.
 */
export const SCATTER_SKIP_RECTS: readonly Rect[] = scatterSkipRects(SCRAP_MAP)
