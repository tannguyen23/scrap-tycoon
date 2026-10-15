import { describe, expect, it } from 'vitest'
import { DECOR_SPECIMENS } from '@ground/packs/scrapYard/decorItems'
import type { GroundCanvas } from '@ground/core/groundCanvas'

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

describe('decor specimens', () => {
  it('covers every family with a labelled, sized catalog', () => {
    expect(DECOR_SPECIMENS.length).toBeGreaterThanOrEqual(15)
    const keys = new Set(DECOR_SPECIMENS.map((specimen) => specimen.key))
    expect(keys.size).toBe(DECOR_SPECIMENS.length)
    const groups = new Set(DECOR_SPECIMENS.map((specimen) => specimen.group))
    expect(groups.size).toBeGreaterThanOrEqual(4)
    for (const specimen of DECOR_SPECIMENS) {
      expect(specimen.label.length, specimen.key).toBeGreaterThan(2)
      expect(specimen.width, specimen.key).toBeGreaterThanOrEqual(14)
      expect(specimen.height, specimen.key).toBeGreaterThanOrEqual(10)
    }
  })

  for (const specimen of DECOR_SPECIMENS) {
    it(`${specimen.key}: art fits its declared box and reads as layered shapes`, () => {
      const { canvas, draws } = recorder()
      specimen.draw(canvas, ANCHOR.x, ANCHOR.y)
      expect(draws.length, specimen.key).toBeGreaterThanOrEqual(4)

      let drawnWidth = 0
      for (const draw of draws) {
        const box = extents(draw)
        expect(box.minX, `${specimen.key} minX`).toBeGreaterThanOrEqual(ANCHOR.x - specimen.width / 2)
        expect(box.maxX, `${specimen.key} maxX`).toBeLessThanOrEqual(ANCHOR.x + specimen.width / 2)
        expect(box.minY, `${specimen.key} minY`).toBeGreaterThanOrEqual(ANCHOR.y - specimen.height)
        // Contact shadows legitimately spill below the base (up to ~10px on the
        // widest pieces); nothing else may go under the anchor.
        expect(box.maxY, `${specimen.key} maxY`).toBeLessThanOrEqual(ANCHOR.y + 10)
        expect(draw.alpha, specimen.key).toBeGreaterThan(0)
        expect(draw.alpha, specimen.key).toBeLessThanOrEqual(1)
        drawnWidth = Math.max(drawnWidth, box.maxX - box.minX)
      }
      // The declared box must not be wildly larger than the art (keeps lists tidy).
      expect(drawnWidth, specimen.key).toBeGreaterThan(specimen.width * 0.3)
    })
  }

  it('keeps one tall landmark, so 1× view has something for the eye to catch', () => {
    const tallest = [...DECOR_SPECIMENS].sort((a, b) => b.height - a.height)[0]
    // Everything else on the map is scenery-sized (trees top out at 44).
    expect(tallest?.height, 'no landmark left: the yard reads as a flat scatter').toBeGreaterThanOrEqual(80)
  })

  it('gives every specimen a distinct silhouette (no copy-paste duplicates)', () => {
    const signatures = new Set<string>()
    for (const specimen of DECOR_SPECIMENS) {
      const { canvas, draws } = recorder()
      specimen.draw(canvas, ANCHOR.x, ANCHOR.y)
      signatures.add(JSON.stringify(draws))
    }
    expect(signatures.size).toBe(DECOR_SPECIMENS.length)
  })
})