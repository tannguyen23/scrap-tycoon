import { Container, Graphics } from 'pixi.js'
import { makeRandom } from './random'
import { ZONE_LAYOUTS } from './zoneLayout'

/**
 * LOD-2 specks drawn on a 0.25 design-px grid — the finest tier: sand grains,
 * ants, rust spots and sprouts that only land on whole canvas pixels at the
 * 4× zoom and stay invisible below it.
 */
export function createNanoDetails(): Container {
  const layer = new Container()
  const props = new Graphics()

  const rnd = makeRandom(777001)
  for (const zoneId of ['alley', 'recycle', 'route', 'depot', 'gate']) {
    const layout = ZONE_LAYOUTS[zoneId]
    if (!layout) continue
    const rect = layout.rect
    for (let i = 0; i < 24; i++) {
      const x = quantize(rect.x + 6 + rnd() * (rect.width - 12))
      const y = quantize(rect.y + 6 + rnd() * (rect.height - 12))
      drawSpeck(props, x, y, Math.floor(rnd() * 4))
    }
  }

  layer.addChild(props)
  return layer
}

function quantize(value: number): number {
  return Math.round(value * 4) / 4
}

function drawSpeck(g: Graphics, x: number, y: number, kind: number): void {
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
