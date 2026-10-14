import { Container, Graphics } from 'pixi.js'
import { makeRandom } from './random'
import { ZONE_LAYOUTS } from './zoneLayout'

/**
 * LOD-1 micro props drawn on a 0.5 design-px grid — they only land on whole
 * canvas pixels once the camera pushes past 2× and stay sub-pixel below that,
 * so they appear as you zoom in.
 */
export function createMicroDetails(): Container {
  const layer = new Container()
  const props = new Graphics()

  const rnd = makeRandom(20261013)
  for (const zoneId of ['alley', 'recycle', 'route', 'depot', 'gate']) {
    const layout = ZONE_LAYOUTS[zoneId]
    if (!layout) continue
    const rect = layout.rect
    for (let i = 0; i < 14; i++) {
      const x = quantize(rect.x + 10 + rnd() * (rect.width - 20))
      const y = quantize(rect.y + 10 + rnd() * (rect.height - 20))
      drawMicroProp(props, x, y, Math.floor(rnd() * 5))
    }
  }

  layer.addChild(props)
  return layer
}

function quantize(value: number): number {
  return Math.round(value * 2) / 2
}

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
