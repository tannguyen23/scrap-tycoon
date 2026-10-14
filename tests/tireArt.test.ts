import { describe, expect, it } from 'vitest'
import { drawTire, drawTireStack as drawDecorTireStack } from '@ui/scene/decorItems'
import {
  HEAP_HALF_WIDTH,
  HEAP_HEIGHT,
  drawFlatTire,
  drawJunkHeap,
  drawLeaningTire,
  drawTireStack,
} from '@ui/scene/focus/alley/sprites'
import type { GroundCanvas } from '@ui/scene/tiles/groundCanvas'

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

function luma(color: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ANCHOR = { x: 100, y: 100 }

const TIRE_DRAWERS = [
  {
    name: 'lốp nằm (khu ngõ)',
    count: 1,
    draw: (g: GroundCanvas) => drawFlatTire(g, ANCHOR.x, ANCHOR.y, 10),
  },
  {
    name: 'lốp dựng tựa (khu ngõ)',
    count: 1,
    draw: (g: GroundCanvas) => drawLeaningTire(g, ANCHOR.x, ANCHOR.y, 7),
  },
  {
    name: 'lốp nằm (decor)',
    count: 1,
    draw: (g: GroundCanvas) => drawTire(g, ANCHOR.x, ANCHOR.y),
  },
  {
    name: 'chồng lốp (khu ngõ)',
    count: 3,
    draw: (g: GroundCanvas) => drawTireStack(g, ANCHOR.x, ANCHOR.y, 3),
  },
  {
    name: 'chồng lốp (decor)',
    count: 3,
    draw: (g: GroundCanvas) => drawDecorTireStack(g, ANCHOR.x, ANCHOR.y),
  },
]

describe('tire art', () => {
  for (const tire of TIRE_DRAWERS) {
    it(`${tire.name}: each tire is a donut — a dark hole inside a wider, lighter face`, () => {
      const { canvas, draws } = recorder()
      tire.draw(canvas)
      expect(draws.length, tire.name).toBeGreaterThanOrEqual(6)
      for (const draw of draws) {
        expect(draw.alpha, tire.name).toBeGreaterThan(0)
        expect(draw.alpha, tire.name).toBeLessThanOrEqual(1)
      }

      const ellipses = draws.filter((draw) => draw.kind === 'ellipse')
      const widest = Math.max(...ellipses.map((draw) => draw.width))
      // Hole = a dark ellipse much narrower than the tire body. A lighter "hub"
      // (the old floating black ring) is exactly what this must keep out.
      const holes = ellipses.filter((draw) => draw.width <= widest * 0.6 && luma(draw.color) < 40)
      expect(holes.length, `${tire.name} holes`).toBe(tire.count)
      for (const hole of holes) {
        const earlier = draws.slice(0, draws.indexOf(hole))
        const face = earlier
          .filter((draw) => draw.kind === 'ellipse' && draw.width >= hole.width * 1.4)
          .find((draw) => luma(draw.color) > luma(hole.color) + 10)
        expect(face, `${tire.name}: hole at ${hole.x},${hole.y} has no lighter face around it`).toBeDefined()
      }
    })
  }

  it('keeps the alley tire stack inside its footprint', () => {
    const { canvas, draws } = recorder()
    drawTireStack(canvas, ANCHOR.x, ANCHOR.y, 3)
    for (const draw of draws) {
      const box = extents(draw)
      expect(box.minX).toBeGreaterThanOrEqual(ANCHOR.x - 12.5)
      expect(box.maxX).toBeLessThanOrEqual(ANCHOR.x + 12.5)
      expect(box.minY).toBeGreaterThanOrEqual(ANCHOR.y - 17)
      expect(box.maxY).toBeLessThanOrEqual(ANCHOR.y + 6.5)
    }
  })
})

describe('alley junk heaps', () => {
  for (let variant = 0; variant < HEAP_HEIGHT.length; variant++) {
    it(`variant ${variant}: heap art stays on the heap`, () => {
      const { canvas, draws } = recorder()
      drawJunkHeap(canvas, ANCHOR.x, ANCHOR.y, variant)
      const half = HEAP_HALF_WIDTH[variant] ?? 20
      const height = HEAP_HEIGHT[variant] ?? 30
      expect(draws.length, `variant ${variant}`).toBeGreaterThanOrEqual(8)
      for (const draw of draws) {
        const box = extents(draw)
        expect(box.minX, `variant ${variant} minX`).toBeGreaterThanOrEqual(ANCHOR.x - (half + 6))
        expect(box.maxX, `variant ${variant} maxX`).toBeLessThanOrEqual(ANCHOR.x + (half + 6))
        expect(box.minY, `variant ${variant} minY`).toBeGreaterThanOrEqual(ANCHOR.y - (height + 12))
        expect(box.maxY, `variant ${variant} maxY`).toBeLessThanOrEqual(ANCHOR.y + 11)
      }
    })
  }
})
