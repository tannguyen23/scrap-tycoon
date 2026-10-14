import { describe, expect, it } from 'vitest'
import { blobContour } from '@ground/core/edgeGeometry'
import type { GroundCanvas } from '@ground/core/groundCanvas'
import { paintWallBands } from '@ground/core/wallBands'
import { terrainTones } from '@ground/packs/scrapYard/terrains'

interface Draw {
  x: number
  y: number
  alpha: number
}

function recorder(): { canvas: GroundCanvas; draws: Draw[] } {
  const draws: Draw[] = []
  const canvas: GroundCanvas = {
    rect(x, y) {
      draws.push({ x, y, alpha: 0 })
      return canvas
    },
    ellipse(x, y) {
      draws.push({ x, y, alpha: 0 })
      return canvas
    },
    circle(x, y) {
      draws.push({ x, y, alpha: 0 })
      return canvas
    },
    fill(style) {
      const last = draws[draws.length - 1]
      if (last) last.alpha = typeof style === 'number' ? 1 : style.alpha
      return canvas
    },
  }
  return { canvas, draws }
}

describe('plateau wall', () => {
  it('draws only on edges that face the camera', () => {
    // A square contour: south edge at y = 16, north edge at y = 0.
    const square = [0, 0, 16, 0, 16, 16, 0, 16]
    const { canvas, draws } = recorder()
    paintWallBands(canvas, square, terrainTones('dirt'))

    // Wall + base line + cast shadow on the south side.
    expect(draws.some((draw) => draw.y >= 16 && draw.y <= 25)).toBe(true)
    // Nothing sticks out above the north edge except its own 1px crest pixel: a
    // wall wrongly drawn there would put its face and shadow ~7–9px above.
    expect(draws.some((draw) => draw.y < -1)).toBe(false)
    const southDepth = Math.max(...draws.map((draw) => draw.y)) - 16
    expect(southDepth).toBeGreaterThan(4)
    expect(southDepth).toBeLessThanOrEqual(10)
  })

  it('follows a wobbly clearing outline without gaps', () => {
    const contour = blobContour({ x: 200, y: 150, width: 120, height: 70 }, 12, 17)
    const { canvas, draws } = recorder()
    paintWallBands(canvas, contour, terrainTones('dirt'))

    expect(draws.length).toBeGreaterThan(100)
    for (const draw of draws) {
      expect(draw.alpha).toBeGreaterThan(0)
      expect(draw.alpha).toBeLessThanOrEqual(1)
    }
  })

  it('is deterministic and does nothing for a degenerate contour', () => {
    const a = recorder()
    const b = recorder()
    const contour = blobContour({ x: 10, y: 10, width: 60, height: 40 }, 8, 3)
    paintWallBands(a.canvas, contour, terrainTones('dirt'))
    paintWallBands(b.canvas, contour, terrainTones('dirt'))
    expect(a.draws.length).toBe(b.draws.length)
    expect(a.draws[0]).toEqual(b.draws[0])

    const empty = recorder()
    paintWallBands(empty.canvas, [], terrainTones('dirt'))
    paintWallBands(empty.canvas, [4, 4], terrainTones('dirt'))
    expect(empty.draws.length).toBe(0)
  })
})