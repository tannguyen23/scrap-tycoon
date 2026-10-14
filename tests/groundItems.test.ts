import { describe, expect, it } from 'vitest'
import { makeRandom } from '@ui/scene/random'
import type { GroundCanvas } from '@ground/core/groundCanvas'
import {
  DEBRIS_KINDS,
  FLORA_KINDS,
  WATER_KINDS,
  drawDebrisItem,
  drawFloraItem,
  drawWaterItem,
  pickWaterKind,
} from '@ground/packs/scrapYard/specimens'

interface Draw {
  kind: 'rect' | 'ellipse'
  x: number
  y: number
  width: number
  height: number
  color: number
  alpha: number
}

function recorder(): { canvas: GroundCanvas; draws: Draw[] } {
  const draws: Draw[] = []
  const canvas: GroundCanvas = {
    rect(x, y, width, height) {
      draws.push({ kind: 'rect', x, y, width, height, color: 0, alpha: 0 })
      return canvas
    },
    ellipse(x, y, radiusX, radiusY) {
      draws.push({ kind: 'ellipse', x, y, width: radiusX, height: radiusY, color: 0, alpha: 0 })
      return canvas
    },
    circle(x, y, radius) {
      draws.push({ kind: 'ellipse', x, y, width: radius, height: radius, color: 0, alpha: 0 })
      return canvas
    },
    fill(style) {
      const last = draws[draws.length - 1]
      if (last) {
        last.color = typeof style === 'number' ? style : style.color
        last.alpha = typeof style === 'number' ? 1 : style.alpha
      }
      return canvas
    },
  }
  return { canvas, draws }
}

function extents(draw: Draw): { minX: number; minY: number; maxX: number; maxY: number } {
  if (draw.kind === 'ellipse') {
    return {
      minX: draw.x - draw.width,
      minY: draw.y - draw.height,
      maxX: draw.x + draw.width,
      maxY: draw.y + draw.height,
    }
  }
  return { minX: draw.x, minY: draw.y, maxX: draw.x + draw.width, maxY: draw.y + draw.height }
}

const ANCHOR = { x: 100, y: 100 }

const drawers = [
  { name: 'flora', draw: drawFloraItem, kinds: FLORA_KINDS },
  { name: 'debris', draw: drawDebrisItem, kinds: DEBRIS_KINDS },
  { name: 'water', draw: drawWaterItem, kinds: WATER_KINDS },
]

describe('ground scatter specimens', () => {
  for (const { name, draw, kinds } of drawers) {
    it(`${name}: every specimen draws in a small box around its anchor`, () => {
      const signatures = new Set<string>()
      for (let kind = 0; kind < kinds; kind++) {
        const { canvas, draws } = recorder()
        draw(canvas, ANCHOR.x, ANCHOR.y, kind, makeRandom(kind + 1))
        expect(draws.length, `${name} ${kind}`).toBeGreaterThanOrEqual(1)
        for (const draw of draws) {
          const box = extents(draw)
          expect(box.minX, `${name} ${kind} x`).toBeGreaterThanOrEqual(ANCHOR.x - 12)
          expect(box.maxX, `${name} ${kind} x`).toBeLessThanOrEqual(ANCHOR.x + 12)
          expect(box.minY, `${name} ${kind} y`).toBeGreaterThanOrEqual(ANCHOR.y - 12)
          expect(box.maxY, `${name} ${kind} y`).toBeLessThanOrEqual(ANCHOR.y + 12)
          expect(draw.alpha).toBeGreaterThan(0)
          expect(draw.alpha).toBeLessThanOrEqual(1)
        }
        signatures.add(JSON.stringify(draws))
      }
      // No two kinds may be carbon copies — catches copy-paste slips in the switch.
      expect(signatures.size).toBe(kinds)
    })
  }

  it('gives calm water plants (flowers, pads) and dirty water junk', () => {
    const plants = new Set([1, 5, 8, 9, 10, 11])
    const junk = new Set([0, 2, 3])
    const calm = makeRandom(11)
    const dirty = makeRandom(23)
    for (let i = 0; i < 300; i++) {
      expect(plants.has(pickWaterKind(0.9, calm)), `calm ${i}`).toBe(true)
      expect(junk.has(pickWaterKind(0.1, dirty)), `dirty ${i}`).toBe(true)
    }
  })

  it('scatters flowers and pads through neutral water too', () => {
    const rnd = makeRandom(41)
    const seen = new Set<number>()
    for (let i = 0; i < 400; i++) {
      seen.add(pickWaterKind(0.5, rnd))
    }
    // The neutral band mixes both worlds, so water plants must show up there too.
    expect([...seen].some((kind) => kind >= 8)).toBe(true)
    expect(seen.size).toBeGreaterThan(6)
  })
})