import { describe, expect, it } from 'vitest'
import { drawZoneFence } from '@ui/scene/focus/fence'
import type { GroundCanvas } from '@ui/scene/tiles/groundCanvas'
import type { FenceOpening } from '@ui/scene/zoneLayout'

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

const SIZE = { width: 128, height: 96 }
const OPENINGS: readonly FenceOpening[] = [
  { edge: 'south', from: 40, to: 80 },
  { edge: 'east', from: 20, to: 50 },
]

/** Trụ cổng dùng tông riêng (0xa4aab6) — cũng là cách test đếm được chúng. */
const GATE_POST = 0xa4aab6

function fence(openings: readonly FenceOpening[] = OPENINGS): Draw[] {
  const { canvas, draws } = recorder()
  drawZoneFence(canvas, SIZE, openings)
  return draws
}

describe('zone fence', () => {
  it('wraps all four edges and stays inside the fence bands', () => {
    const draws = fence()
    expect(draws.length).toBeGreaterThan(20)

    const edges = { north: 0, south: 0, west: 0, east: 0 }
    for (const draw of draws) {
      expect(draw.alpha).toBeGreaterThan(0)
      expect(draw.alpha).toBeLessThanOrEqual(1)
      const box = extents(draw)
      // Trụ góc nằm đúng trên đường biên nên art vươn nhẹ ra ngoài (±mũ trụ) —
      // bound 2.5 vẫn khoá được "hàng rào chỉ là dải mỏng quanh cạnh".
      expect(box.minX, 'west band').toBeGreaterThanOrEqual(-2.5)
      expect(box.maxX, 'east band').toBeLessThanOrEqual(SIZE.width + 2.5)
      expect(box.minY, 'north band').toBeGreaterThanOrEqual(-11)
      expect(box.maxY, 'south band').toBeLessThanOrEqual(SIZE.height + 2)
      if (box.maxY <= 0.6) edges.north++
      else if (box.minY >= SIZE.height - 15) edges.south++
      else if (box.maxX <= 5) edges.west++
      else if (box.minX >= SIZE.width - 5) edges.east++
    }
    expect(edges.north).toBeGreaterThan(2)
    expect(edges.south).toBeGreaterThan(2)
    expect(edges.west).toBeGreaterThan(2)
    expect(edges.east).toBeGreaterThan(2)
  })

  it('cuts the fence exactly where an opening is declared', () => {
    const solid = fence([])
    const cut = fence()

    const southSpan = (draws: Draw[]): Draw[] =>
      draws.filter((draw) => {
        const box = extents(draw)
        return box.maxX > 43 && box.minX < 77 && box.maxY > SIZE.height - 15
      })
    const eastSpan = (draws: Draw[]): Draw[] =>
      draws.filter((draw) => {
        const box = extents(draw)
        // Trụ cổng mọc lên từ mép nam của lỗ mở nên chỉ soi phần trong của lỗ.
        return box.maxY > 23 && box.minY < 37 && box.minX >= SIZE.width - 5
      })

    expect(southSpan(solid).length).toBeGreaterThan(0)
    expect(southSpan(cut).length).toBe(0)
    expect(eastSpan(solid).length).toBeGreaterThan(0)
    expect(eastSpan(cut).length).toBe(0)

    // Mỗi lỗ mở được chốt bằng đúng hai trụ cổng.
    expect(cut.filter((draw) => draw.color === GATE_POST).length).toBe(OPENINGS.length * 2)
  })

  it('mixes tin and wood in uneven panels instead of one uniform fence', () => {
    const { canvas, draws } = recorder()
    drawZoneFence(canvas, { width: 320, height: 96 })

    // Đỉnh hàng rào nam phải so le nhiều mức, không phải một đường thẳng.
    const tops = new Set(
      draws
        .filter((draw) => {
          const box = extents(draw)
          return box.maxY > 79 && box.minX > 3 && box.maxX < 316
        })
        .map((draw) => Math.round(extents(draw).minY)),
    )
    expect(tops.size).toBeGreaterThanOrEqual(3)

    // Cả tông gỗ/gỉ (nâu ấm) lẫn tông tôn (xám lạnh) đều phải có mặt.
    const warm = draws.filter((draw) => ((draw.color >> 16) & 0xff) > (draw.color & 0xff) + 10)
    const cool = draws.filter((draw) => (draw.color & 0xff) > ((draw.color >> 16) & 0xff) + 10)
    expect(warm.length, 'ván gỗ / vệt gỉ').toBeGreaterThanOrEqual(2)
    expect(cool.length, 'tôn mạ').toBeGreaterThanOrEqual(2)
  })
})
