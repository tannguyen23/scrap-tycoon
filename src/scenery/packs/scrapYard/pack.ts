import { Graphics } from 'pixi.js'
import { insideAnyRect } from '@ground/core/metrics'
import type { AmbienceSpec } from '@scenery/core/ambience'
import { createDetailLayer, type DetailDrawer, type DetailProp } from '@scenery/core/details'
import { DAY_LENGTH_SECONDS, type LightSource } from '@scenery/core/lighting'
import { makeRandom } from '@scenery/core/random'
import type { SceneryPack } from '@scenery/core/pack'
import { WATER_AREAS, WORLD_HEIGHT, WORLD_WIDTH, ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'

export { DAY_LENGTH_SECONDS, createDetailLayer }
export type { DetailDrawer, DetailProp, LightSource, SceneryPack }

/**
 * Warm light pools: burning barrel, depot lamp + window, gate booth, street lamps, forge mouth.
 * Coordinates follow the core district (zones moved onto the avenue, world 10240×5760).
 */
const SCRAP_LIGHTS: readonly LightSource[] = [
  { x: 4136, y: 2190, radius: 46, color: 0xffa54d, flicker: 0.16 }, // thùng phuy đốt khu ve chai
  { x: 4052, y: 3044, radius: 42, color: 0xffd88a }, // đèn kho
  { x: 4043, y: 3065, radius: 34, color: 0xffd27f }, // cửa sổ kho
  { x: 6282, y: 3047, radius: 34, color: 0xffe0a0 }, // chòi gác cổng xuất
  // Cửa lò xưởng tái chế (world = zone rect 5120,2104 + local 150,56) — nhấp nháy mạnh.
  { x: 5270, y: 2160, radius: 54, color: 0xffb45a, flicker: 0.22 },
  // Đèn đường dọc đại lộ (khu route tự có đèn riêng trong scene, nên bỏ khoảng đó).
  ...Array.from({ length: 10 }, (_, index) => {
    const x = 600 + index * 800 < 4512 ? 600 + index * 800 : 600 + index * 800 + 1600
    return { x, y: 2854, radius: 48, color: 0xffd9a0 }
  }),
]

const MICRO_PER_ZONE = 14
const NANO_PER_ZONE = 24

/**
 * …and the same again over the open ground between the zones. Zooming into the
 * middle of the world must reveal something everywhere, not just inside yards —
 * so the open field is scaled with the map (about 64× the old area).
 */
const MICRO_OPEN = 6400
const NANO_OPEN = 9600

/**
 * Nothing is dropped inside a zone (that zone's own scene dresses it) or onto a
 * pond, where litter would read as floating. The water margin also absorbs the
 * prop quantisation, so a prop can never round onto the waterline.
 */
const OPEN_SKIP = [
  ...Object.values(ZONE_LAYOUTS).map((layout) => layout.rect),
  ...inflateRects(
    WATER_AREAS.map((area) => area.rect),
    6,
  ),
]

function inflateRects(rects: readonly { x: number; y: number; width: number; height: number }[], pad: number) {
  return rects.map((rect) => ({
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }))
}

/** Ground-bird patches: open ground and wilderness, never a yard or a pond. */
function scrapGroundBirds(): { x: number; y: number }[] {
  const rnd = makeRandom(20261015)
  const birds: { x: number; y: number }[] = []
  const nearWater = inflateRects(WATER_AREAS.map((area) => area.rect), 40)
  for (let tries = 0; tries < 4000 && birds.length < 42; tries++) {
    const x = 60 + rnd() * (WORLD_WIDTH - 120)
    const y = 60 + rnd() * (WORLD_HEIGHT - 120)
    if (insideAnyRect(OPEN_SKIP, x, y)) continue
    // A margin, so the peck radius can never hop onto a bank.
    if (insideAnyRect(nearWater, x, y)) continue
    birds.push({ x: Math.round(x), y: Math.round(y) })
  }
  return birds
}

/**
 * Smoke stacks and the birds that live on the ground. One chimney on a map this
 * big would read as a diorama; every place that burns something smoulders, and
 * the wilderness has its own campfires and residents.
 */
const SCRAP_AMBIENCE: AmbienceSpec = {
  smoke: [
    { x: 4020, y: 3032 }, // ống khói nhà kho
    { x: 5270, y: 2148 }, // ống khói lò xưởng tái chế (ngay trên miệng lò)
    { x: 4136, y: 2182 }, // thùng phuy đốt ở khu ve chai
    { x: 6400, y: 3480 }, // đống sắt vụn âm ỉ ở bãi đông-nam
    { x: 1500, y: 3900 }, // lửa trại ven hồ
    { x: 8300, y: 3500 }, // lửa trại trong rừng đông
    { x: 3300, y: 800 }, // lửa trại bãi bắc
    { x: 9400, y: 4800 }, // lửa trại góc đông-nam
  ],
  birds: [
    { x: -60, y: 88, speed: 44 },
    { x: -300, y: 164, speed: 52 },
    { x: -560, y: 128, speed: 38 },
  ],
  groundBirds: scrapGroundBirds(),
  worldWidth: WORLD_WIDTH,
  seed: 90210,
}

function quantize(value: number, step: number): number {
  return Math.round(value * step) / step
}

/** Even-off spots across the whole map, skipping the zones and the water. */
function openGround(rnd: () => number, count: number): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = []
  // Bounded, so growing the map can never spin this loop forever.
  for (let tries = 0; tries < count * 40 && spots.length < count; tries++) {
    const x = 8 + rnd() * (WORLD_WIDTH - 16)
    const y = 8 + rnd() * (WORLD_HEIGHT - 16)
    if (insideAnyRect(OPEN_SKIP, x, y)) continue
    spots.push({ x, y })
  }
  return spots
}

/** Positions are generated once, per seed: the zones first, then the open field. */
function microProps(): DetailProp[] {
  const props: DetailProp[] = []
  const rnd = makeRandom(20261013)
  for (const zoneId of ['alley', 'recycle', 'route', 'depot', 'gate']) {
    const layout = ZONE_LAYOUTS[zoneId]
    if (!layout) continue
    const rect = layout.rect
    for (let i = 0; i < MICRO_PER_ZONE; i++) {
      props.push({
        x: quantize(rect.x + 10 + rnd() * (rect.width - 20), 2),
        y: quantize(rect.y + 10 + rnd() * (rect.height - 20), 2),
        kind: Math.floor(rnd() * 5),
      })
    }
  }
  for (const spot of openGround(rnd, MICRO_OPEN)) {
    props.push({ x: quantize(spot.x, 2), y: quantize(spot.y, 2), kind: Math.floor(rnd() * 5) })
  }
  return props
}

function nanoProps(): DetailProp[] {
  const props: DetailProp[] = []
  const rnd = makeRandom(777001)
  for (const zoneId of ['alley', 'recycle', 'route', 'depot', 'gate']) {
    const layout = ZONE_LAYOUTS[zoneId]
    if (!layout) continue
    const rect = layout.rect
    for (let i = 0; i < NANO_PER_ZONE; i++) {
      props.push({
        x: quantize(rect.x + 6 + rnd() * (rect.width - 12), 4),
        y: quantize(rect.y + 6 + rnd() * (rect.height - 12), 4),
        kind: Math.floor(rnd() * 4),
      })
    }
  }
  for (const spot of openGround(rnd, NANO_OPEN)) {
    props.push({ x: quantize(spot.x, 4), y: quantize(spot.y, 4), kind: Math.floor(rnd() * 4) })
  }
  return props
}

/** 0.5px-grid yard litter: screws, paper scraps, glass, leaves, nails. */
function drawMicroProp(g: Graphics, x: number, y: number, kind: number): void {
  switch (kind) {
    case 0: {
      // ốc vít
      g.rect(x, y, 2, 1.5).fill(0x9aa8b6)
      g.rect(x + 0.5, y + 0.5, 1, 0.5).fill(0x6b7480)
      break
    }
    case 1: {
      // mẩu giấy
      g.rect(x, y, 2.5, 1.5).fill({ color: 0xe8e0c8, alpha: 0.9 })
      g.rect(x + 0.5, y + 0.5, 1.5, 0.5).fill({ color: 0xb9ad8d, alpha: 0.9 })
      break
    }
    case 2: {
      // mảnh chai
      g.rect(x, y, 1, 0.5).fill({ color: 0x9fd4d0, alpha: 0.85 })
      g.rect(x + 1.5, y + 1, 0.5, 0.5).fill({ color: 0x9fd4d0, alpha: 0.7 })
      break
    }
    case 3: {
      // lá rụng
      g.rect(x, y, 1.5, 1).fill({ color: 0x7fb054, alpha: 0.95 })
      g.rect(x + 0.5, y - 0.5, 0.5, 0.5).fill({ color: 0x93c25f, alpha: 0.95 })
      break
    }
    default: {
      // đinh
      g.rect(x, y, 0.5, 2).fill(0xaab3c0)
      g.rect(x - 0.5, y, 1.5, 0.5).fill(0x8a97a6)
      break
    }
  }
}

/** 0.25px-grid specks: sand grains, ants, rust, sprouts. */
function drawNanoSpeck(g: Graphics, x: number, y: number, kind: number): void {
  switch (kind) {
    case 0: {
      // hạt sạn
      g.rect(x, y, 0.25, 0.25).fill({ color: 0x8a7a5a, alpha: 0.9 })
      g.rect(x + 0.5, y + 0.25, 0.25, 0.25).fill({ color: 0x6f6248, alpha: 0.8 })
      break
    }
    case 1: {
      // đàn kiến
      g.rect(x, y, 0.25, 0.25).fill(0x2b2320)
      g.rect(x + 0.5, y - 0.25, 0.25, 0.25).fill(0x2b2320)
      g.rect(x + 1, y, 0.25, 0.25).fill(0x2b2320)
      break
    }
    case 2: {
      // vết gỉ
      g.rect(x, y, 0.5, 0.25).fill({ color: 0x8a5a34, alpha: 0.85 })
      break
    }
    default: {
      // mầm cỏ
      g.rect(x, y, 0.25, 0.75).fill({ color: 0x6a8a4a, alpha: 0.9 })
      g.rect(x + 0.25, y, 0.25, 0.25).fill({ color: 0x7a9a55, alpha: 0.9 })
      break
    }
  }
}

/**
 * The scrap-yard scenery pack: its light pools, smoke/bird spec and the two LOD
 * prop layers, with the drawers that draw them. The kit owns the layers.
 */
export const SCRAP_SCENERY: SceneryPack = {
  id: 'scrapYard',
  label: 'Scrap Yard / Đồng nát',
  lights: SCRAP_LIGHTS,
  ambience: SCRAP_AMBIENCE,
  microProps: microProps(),
  drawMicro: drawMicroProp,
  nanoProps: nanoProps(),
  drawNano: drawNanoSpeck,
}
