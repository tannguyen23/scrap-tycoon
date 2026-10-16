import { makeRandom } from '@ground/core/random'
import type { Rect } from '@ground/core/metrics'
import type { Graphics } from 'pixi.js'
import { DECOR_SPECIMENS, decorBox } from './decorItems'
import {
  AVENUE_HEIGHT,
  AVENUE_Y,
  CLEARINGS,
  CONNECTORS,
  WATER_AREAS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
  insideAnyRect,
  type ZoneRect,
} from './worldLayout'

export interface DecorPlacement {
  /** Key into `DECOR_SPECIMENS` — a typo is caught by `tests/worldDecor.test.ts`. */
  key: string
  x: number
  y: number
}

const SPECIMENS = new Map(DECOR_SPECIMENS.map((specimen) => [specimen.key, specimen]))

/** Painted lanes and links of `worldGrounds.SCRAP_MAP` (locked by the decor test). */
const DIRT_LANES: readonly ZoneRect[] = [
  { x: 4062, y: 2246, width: 72, height: 602 },
  { x: 4240, y: 2196, width: 880, height: 48 },
]
const YARD_LINKS: readonly ZoneRect[] = [
  { x: 4052, y: 2966, width: 76, height: 88 },
  { x: 6300, y: 2966, width: 84, height: 84 },
  { x: 6486, y: 3036, width: 72, height: 50 },
]

/**
 * Where decor may NOT stand: every yard, every drop of water, every painted lane,
 * link, driveway and the avenue itself. A tree on a road reads as a bug even
 * before the player can walk into it — `tests/worldDecor.test.ts` locks this
 * against the real map data, so the list cannot drift from `worldGrounds`.
 */
const KEEP_OUT: readonly ZoneRect[] = [
  ...Object.values(ZONE_LAYOUTS).map((layout) => layout.rect),
  ...WATER_AREAS.map((area) => area.rect),
  ...CONNECTORS,
  ...DIRT_LANES,
  ...YARD_LINKS,
  { x: 0, y: AVENUE_Y, width: WORLD_WIDTH, height: AVENUE_HEIGHT },
]

function blocked(x: number, y: number, pad: number): boolean {
  return insideAnyRect(inflateAll(KEEP_OUT, pad), x, y)
}

const padded = new Map<number, ZoneRect[]>()
function inflateAll(rects: readonly ZoneRect[], pad: number): ZoneRect[] {
  let list = padded.get(pad)
  if (!list) {
    list = rects.map((rect) => ({
      x: rect.x - pad,
      y: rect.y - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    }))
    padded.set(pad, list)
  }
  return list
}

const rnd = makeRandom(20261014)

/** One seeded, keep-out-respecting placement pass. */
function sprinkle(
  into: DecorPlacement[],
  count: number,
  keys: readonly string[],
  area: ZoneRect,
  pad = 10,
  tries = 40,
): void {
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < tries; attempt++) {
      const x = Math.round(area.x + rnd() * area.width)
      const y = Math.round(area.y + rnd() * area.height)
      if (blocked(x, y, pad)) continue
      const key = keys[Math.floor(rnd() * keys.length)] ?? keys[0]
      if (!key) return
      into.push({ key, x, y })
      break
    }
  }
}

/** A clump of trees around a centre — the forest unit. */
function grove(into: DecorPlacement[], cx: number, cy: number, count: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const angle = rnd() * Math.PI * 2
    const distance = Math.sqrt(rnd()) * radius
    const x = Math.round(cx + Math.cos(angle) * distance)
    const y = Math.round(cy + Math.sin(angle) * distance * 0.7)
    // Cây cao ~48px tính từ gốc: chừa đủ để tán không trùm lên đường/khu.
    if (blocked(x, y, TREE_CLEARANCE)) continue
    into.push({ key: rnd() < 0.5 ? 'tree0' : 'tree1', x, y })
  }
}

/** A tree's canopy reaches ~48px above its anchor — keep that much clear. */
const TREE_CLEARANCE = 46
/** Bushes/rocks/signs reach ~26px above the anchor. */
const PROP_CLEARANCE = 30

function buildPlacements(): DecorPlacement[] {
  const placements: DecorPlacement[] = []

  // ---- vành cây quanh mép map: khung rừng giữ thế giới lại ---------------------
  const edge = 30
  for (let x = 60; x < WORLD_WIDTH - 40; x += 128) {
    const jitter = Math.round((rnd() - 0.5) * 46)
    for (const y of [edge + jitter, WORLD_HEIGHT - edge - jitter]) {
      if (blocked(x, y, TREE_CLEARANCE)) continue
      placements.push({ key: rnd() < 0.5 ? 'tree0' : 'tree1', x, y })
    }
  }
  for (let y = 140; y < WORLD_HEIGHT - 120; y += 136) {
    const jitter = Math.round((rnd() - 0.5) * 46)
    for (const x of [edge + jitter, WORLD_WIDTH - edge - jitter]) {
      if (blocked(x, y, TREE_CLEARANCE)) continue
      placements.push({ key: rnd() < 0.5 ? 'tree0' : 'tree1', x, y })
    }
  }

  // ---- rừng: từng cụm cây quanh lõi và trong hoang dã -------------------------
  const groves: readonly (readonly [number, number, number, number])[] = [
    [1500, 700, 16, 240],
    [3300, 700, 14, 220],
    [5300, 900, 12, 200],
    [7800, 600, 16, 250],
    [9300, 1100, 14, 230],
    [1700, 2100, 12, 210],
    [2700, 3200, 12, 200],
    [4200, 4200, 14, 220],
    [6400, 4700, 16, 240],
    [8200, 3400, 16, 250],
    [9300, 2400, 14, 230],
    [9300, 4700, 14, 220],
    [5600, 5200, 12, 200],
    [2400, 5100, 14, 220],
    [3800, 2400, 8, 130],
    // Cụm cây chặn góc ngã ba nhập làn (xe tải "ra khỏi thành phố" khuất sau rừng).
    [7300, 2990, 10, 120],
  ]
  for (const [cx, cy, count, radius] of groves) grove(placements, cx, cy, count, radius)

  // ---- điểm khai thác: bãi phế liệu, mỏ sỏi, nền rừng -------------------------
  const scrapFields = CLEARINGS.slice(0, 3)
  for (const field of scrapFields) {
    const area = field.rect
    for (let i = 0; i < 11; i++) {
      const x = Math.round(area.x + 20 + rnd() * (area.width - 40))
      const y = Math.round(area.y + 20 + rnd() * (area.height - 40))
      placements.push({ key: 'scrap', x, y })
    }
    sprinkle(placements, 3, ['barrel0', 'barrel1', 'tireStack', 'pallets'], area, PROP_CLEARANCE)
  }
  // Mỏ sỏi: đá ba cỡ + đống đá quanh mỏ nhô.
  const pit = CLEARINGS[3]
  if (pit) {
    sprinkle(placements, 6, ['rockCluster', 'rockBig', 'rockSmall'], pit.rect, PROP_CLEARANCE)
    sprinkle(placements, 6, ['rock', 'rockSmall', 'stump'], pit.rect, PROP_CLEARANCE)
  }
  // Nền rừng đông-nam: gốc, khúc gỗ, nấm cỏ.
  const forestFloor = CLEARINGS[CLEARINGS.length - 1]
  if (forestFloor) {
    sprinkle(placements, 6, ['log', 'stump', 'tuft'], forestFloor.rect, PROP_CLEARANCE)
  }

  // ---- ven hồ tây: bến bãi, tháp nước landmark ---------------------------------
  placements.push({ key: 'waterTower', x: 2320, y: 2760 })
  sprinkle(
    placements,
    8,
    ['crates', 'barrel0', 'barrel1', 'pallets', 'pipe'],
    { x: 1500, y: 3700, width: 240, height: 170 },
    PROP_CLEARANCE,
  )
  sprinkle(placements, 6, ['tuft', 'bush0', 'bush1'], { x: 1130, y: 2820, width: 140, height: 720 }, PROP_CLEARANCE)

  // ---- dọc đại lộ: biển báo, bụi cỏ, đá ven lề ---------------------------------
  for (let x = 600; x < WORLD_WIDTH - 400; x += 1180) {
    for (const y of [AVENUE_Y - 44, AVENUE_Y + AVENUE_HEIGHT + 44]) {
      if (blocked(x, y, PROP_CLEARANCE)) continue
      placements.push({ key: rnd() < 0.4 ? 'sign' : 'tuft', x, y })
    }
  }

  // ---- rải rác hoang dã: bụi, cỏ bụi, đá, gốc cây ------------------------------
  const wild: ZoneRect = { x: 80, y: 80, width: WORLD_WIDTH - 160, height: WORLD_HEIGHT - 160 }
  sprinkle(placements, 150, ['bush0', 'bush1', 'tuft', 'tuft'], wild, PROP_CLEARANCE)
  sprinkle(placements, 70, ['rock', 'rockSmall', 'rockCluster'], wild, PROP_CLEARANCE)
  sprinkle(placements, 60, ['stump', 'log', 'tuft'], wild, PROP_CLEARANCE)
  sprinkle(placements, 26, ['scrap', 'tire', 'barrel0', 'pipe', 'pallets', 'crates'], wild, PROP_CLEARANCE)

  return placements
}

/**
 * Hand-placed + seeded decor across the map: a forest ring around the world, tree
 * groves, the harvest fields, the lakeside and roadside dressing. Generated from
 * one seed so the layout is stable, but exposed as plain data so the tests can
 * walk it (nothing may stand in a yard, on water or on a road).
 */
export const DECOR_PLACEMENTS: readonly DecorPlacement[] = buildPlacements()

/**
 * Places every specimen of `DECOR_PLACEMENTS` (map and studio draw from one list).
 *
 * `window` keeps chunk painting honest: only the props whose box reaches into the
 * window are drawn, so a 1024px chunk does not pay for all ~850 items of the
 * world (measured at ~21ms per chunk before the filter).
 */
export function drawDecor(g: Graphics, window?: Rect): void {
  for (const placement of DECOR_PLACEMENTS) {
    const specimen = SPECIMENS.get(placement.key)
    if (!specimen) continue
    if (window) {
      const box = decorBox(specimen, placement.x, placement.y)
      if (!overlapsRect(box, window)) continue
    }
    specimen.draw(g, placement.x, placement.y)
  }
}

function overlapsRect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
