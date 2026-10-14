import { Graphics } from 'pixi.js'
import type { AmbienceSpec } from '@scenery/core/ambience'
import { createDetailLayer, type DetailDrawer, type DetailProp } from '@scenery/core/details'
import { DAY_LENGTH_SECONDS, type LightSource } from '@scenery/core/lighting'
import { makeRandom } from '@scenery/core/random'
import type { SceneryPack } from '@scenery/core/pack'
import { WORLD_WIDTH, ZONE_LAYOUTS } from '@ui/scene/zoneLayout'

export { DAY_LENGTH_SECONDS, createDetailLayer }
export type { DetailDrawer, DetailProp, LightSource, SceneryPack }

/** Warm light pools: burning barrel, depot lamp + window, gate booth, street lamps, forge mouth. */
const SCRAP_LIGHTS: readonly LightSource[] = [
  { x: 280, y: 94, radius: 46, color: 0xffa54d, flicker: 0.16 },
  { x: 196, y: 576, radius: 42, color: 0xffd88a },
  { x: 187, y: 597, radius: 34, color: 0xffd27f },
  { x: 882, y: 579, radius: 34, color: 0xffe0a0 },
  { x: 240, y: 386, radius: 48, color: 0xffd9a0 },
  { x: 930, y: 386, radius: 48, color: 0xffd9a0 },
  // Cửa lò xưởng tái chế (world = zone rect 608,8 + local 150,56) — nhấp nháy mạnh.
  { x: 758, y: 64, radius: 54, color: 0xffb45a, flicker: 0.22 },
]

/** Chimney on the depot warehouse roof + three bird lanes crossing the yard. */
const SCRAP_AMBIENCE: AmbienceSpec = {
  smoke: [{ x: 164, y: 564 }],
  birds: [
    { x: -60, y: 88, speed: 44 },
    { x: -300, y: 164, speed: 52 },
    { x: -560, y: 128, speed: 38 },
  ],
  worldWidth: WORLD_WIDTH,
  seed: 90210,
}

const MICRO_PER_ZONE = 14
const NANO_PER_ZONE = 24

function quantize(value: number, step: number): number {
  return Math.round(value * step) / step
}

/** Positions are generated once, from the zone rects, and stay stable per seed. */
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
