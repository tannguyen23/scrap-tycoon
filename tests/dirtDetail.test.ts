import { describe, expect, it } from 'vitest'
import {
  paintDragMarks,
  paintFootprints,
  paintPuddle,
  paintRuts,
  paintStain,
  paintWearPatch,
  paintWearPath,
} from '@ground/packs/scrapYard/decals'
import type { GroundCanvas } from '@ground/core/groundCanvas'

interface Draw {
  kind: 'rect' | 'ellipse'
  x: number
  y: number
  width: number
  height: number
  alpha: number
}

/** Records every shape the trace functions draw (no renderer needed). */
function recorder(): { canvas: GroundCanvas; draws: Draw[] } {
  const draws: Draw[] = []
  const canvas: GroundCanvas = {
    rect(x, y, width, height) {
      draws.push({ kind: 'rect', x, y, width, height, alpha: 0 })
      return canvas
    },
    ellipse(x, y, radiusX, radiusY) {
      draws.push({ kind: 'ellipse', x, y, width: radiusX, height: radiusY, alpha: 0 })
      return canvas
    },
    circle(x, y, radius) {
      draws.push({ kind: 'ellipse', x, y, width: radius, height: radius, alpha: 0 })
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

/** Bounds a shape covers, whichever primitive it is. */
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

const PATH = [
  { x: 20, y: 30 },
  { x: 120, y: 70 },
]
const PATH_BOUNDS = { minX: 20, minY: 30, maxX: 120, maxY: 70 }

function expectWithin(g: GroundCanvas, draws: Draw[], margin: number): void {
  expect(draws.length).toBeGreaterThan(4)
  for (const draw of draws) {
    const box = extents(draw)
    expect(box.minX, `${draw.kind} x`).toBeGreaterThanOrEqual(PATH_BOUNDS.minX - margin)
    expect(box.maxX, `${draw.kind} x`).toBeLessThanOrEqual(PATH_BOUNDS.maxX + margin)
    expect(box.minY, `${draw.kind} y`).toBeGreaterThanOrEqual(PATH_BOUNDS.minY - margin)
    expect(box.maxY, `${draw.kind} y`).toBeLessThanOrEqual(PATH_BOUNDS.maxY + margin)
    expect(draw.alpha).toBeGreaterThan(0)
    // Soft washes stay subtle; only the small pebbles beside the trace may be solid.
    const pebble = draw.kind === 'rect' ? draw.width <= 2 : draw.width <= 2 && draw.height <= 2
    expect(draw.alpha, `${draw.kind} alpha`).toBeLessThanOrEqual(pebble ? 1 : 0.25)
  }
  void g
}

describe('ground usage traces', () => {
  it('draws the wear path on the walk line', () => {
    const { canvas, draws } = recorder()
    paintWearPath(canvas, PATH)
    expectWithin(canvas, draws, 14)
  })

  it('draws footprints on the walk line', () => {
    const { canvas, draws } = recorder()
    paintFootprints(canvas, PATH)
    expectWithin(canvas, draws, 12)
  })

  it('draws drag marks on their line', () => {
    const { canvas, draws } = recorder()
    paintDragMarks(canvas, PATH)
    expectWithin(canvas, draws, 12)
  })

  it('tramples a patch around a spot instead of drawing one more line', () => {
    // Chỗ tụ người (điểm đổ) phải mòn thành MẢNG loang ra — một vệt mòn thứ nữa ở đó là
    // "đường cho nhân vật đi theo", không phải nền bị giẫm.
    const at = { x: 300, y: 200 }
    const radius = 26
    const { canvas, draws } = recorder()
    paintWearPatch(canvas, at, { radius })
    expect(draws.length).toBeGreaterThan(6)

    const sides = new Set<string>()
    for (const draw of draws) {
      const box = extents(draw)
      // Không vết nào rời xa chỗ giẫm quá một bán kính rưỡi.
      expect(Math.hypot(box.minX - at.x, box.minY - at.y)).toBeLessThanOrEqual(radius * 1.6)
      expect(Math.hypot(box.maxX - at.x, box.maxY - at.y)).toBeLessThanOrEqual(radius * 1.6)
      const pebble = draw.kind === 'rect' && draw.width <= 2
      expect(draw.alpha, 'vết mòn phải mờ, sỏi mới được đặc').toBeLessThanOrEqual(pebble ? 1 : 0.25)
      sides.add(`${draw.x < at.x ? 'W' : 'E'}${draw.y < at.y ? 'N' : 'S'}`)
    }
    expect(sides.size, 'mảng mòn phải loang cả bốn phía').toBe(4)
  })

  it('draws ruts on their line', () => {
    const { canvas, draws } = recorder()
    paintRuts(canvas, PATH)
    expectWithin(canvas, draws, 12)
  })

  it('keeps a stain around its anchor', () => {
    const { canvas, draws } = recorder()
    paintStain(canvas, { x: 60, y: 40 }, { radius: 14, soot: true })
    expect(draws.length).toBeGreaterThan(4)
    for (const draw of draws) {
      const box = extents(draw)
      expect(box.minX).toBeGreaterThanOrEqual(60 - 30)
      expect(box.maxX).toBeLessThanOrEqual(60 + 30)
      expect(box.minY).toBeGreaterThanOrEqual(40 - 24)
      expect(box.maxY).toBeLessThanOrEqual(40 + 24)
    }
  })

  it('keeps a puddle around its centre', () => {
    const { canvas, draws } = recorder()
    paintPuddle(canvas, 80, 50, 6, 3)
    expect(draws.length).toBeGreaterThan(2)
    for (const draw of draws) {
      const box = extents(draw)
      expect(box.minX).toBeGreaterThanOrEqual(80 - 10)
      expect(box.maxX).toBeLessThanOrEqual(80 + 10)
      expect(box.minY).toBeGreaterThanOrEqual(50 - 8)
      expect(box.maxY).toBeLessThanOrEqual(50 + 8)
    }
  })

  it('does nothing for a degenerate path', () => {
    const { canvas, draws } = recorder()
    paintWearPath(canvas, [])
    paintWearPath(canvas, [{ x: 5, y: 5 }])
    paintFootprints(canvas, PATH.slice(0, 1))
    expect(draws.length).toBe(0)
  })
})