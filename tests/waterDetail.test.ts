import { describe, expect, it } from 'vitest'
import { blobContour } from '@ground/core/edgeGeometry'
import { paintShore } from '@ground/packs/scrapYard/shore'
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

const RECT = { x: 200, y: 150, width: 60, height: 36 }
const CONTOUR = blobContour(RECT, 8, 91)

describe('water shore dressing', () => {
  it('stays on the shore, never floating off into the map', () => {
    const { canvas, draws } = recorder()
    paintShore(canvas, CONTOUR, 91)
    expect(draws.length).toBeGreaterThan(30)

    // Reeds may lean ~6px over the surface, pebbles sit a few px up the bank, and
  // the contour itself wobbles ~9px past the rect (broad wave + ripple).
  const margin = 18
    for (const draw of draws) {
      const minX = draw.kind === 'ellipse' ? draw.x - draw.width : draw.x
      const maxX = draw.kind === 'ellipse' ? draw.x + draw.width : draw.x + draw.width
      const minY = draw.kind === 'ellipse' ? draw.y - draw.height : draw.y
      const maxY = draw.kind === 'ellipse' ? draw.y + draw.height : draw.y + draw.height
      expect(minX, `${draw.kind} minX`).toBeGreaterThanOrEqual(RECT.x - margin)
      expect(maxX, `${draw.kind} maxX`).toBeLessThanOrEqual(RECT.x + RECT.width + margin)
      expect(minY, `${draw.kind} minY`).toBeGreaterThanOrEqual(RECT.y - margin)
      expect(maxY, `${draw.kind} maxY`).toBeLessThanOrEqual(RECT.y + RECT.height + margin)
      expect(draw.alpha).toBeGreaterThan(0)
      expect(draw.alpha).toBeLessThanOrEqual(1)
    }
  })

  it('is deterministic for a given seed and changes with it', () => {
    const a = recorder()
    const b = recorder()
    const c = recorder()
    paintShore(a.canvas, CONTOUR, 91)
    paintShore(b.canvas, CONTOUR, 91)
    paintShore(c.canvas, CONTOUR, 92)
    expect(a.draws.length).toBe(b.draws.length)
    expect(a.draws[0]).toEqual(b.draws[0])
    expect(JSON.stringify(a.draws)).not.toBe(JSON.stringify(c.draws))
  })

  it('does nothing for a degenerate contour', () => {
    const { canvas, draws } = recorder()
    paintShore(canvas, [], 5)
    paintShore(canvas, [10, 10], 5)
    expect(draws.length).toBe(0)
  })
})