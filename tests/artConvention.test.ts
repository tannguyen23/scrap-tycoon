import { describe, expect, it } from 'vitest'
import type { GroundCanvas } from '@ground/core/groundCanvas'
import { DECOR_SPECIMENS } from '@ground/packs/scrapYard/decorItems'
import { createTruckFrontSprite } from '@ui/scene/focus/gate/sprites'

interface Draw {
  kind: 'rect' | 'ellipse'
  x: number
  y: number
  width: number
  height: number
  color: number
  alpha: number
}

/** Records what a drawer paints, without a renderer (same trick as tireArt.test.ts). */
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

function luma(color: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function box(draw: Draw): { minX: number; minY: number; maxX: number; maxY: number } {
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

const SHADOW_LUMA = 40

/**
 * Luật hình (AGENTS "Dáng Stardew"): vật đứng phải có bậc sáng — dải TRÊN CÙNG sáng
 * hơn khối thân — và phải có bóng tiếp xúc / viền chân tối ở dưới cùng. Bóng và viền
 * chân nằm ngoài phép so (chúng vốn tối/trong suốt).
 */
function expectLadder(name: string, draws: Draw[]): void {
  expect(draws.length, `${name}: quá ít lệnh vẽ`).toBeGreaterThanOrEqual(4)
  for (const draw of draws) {
    expect(draw.alpha, `${name}: alpha phải trong (0,1]`).toBeGreaterThan(0)
    expect(draw.alpha, `${name}: alpha phải trong (0,1]`).toBeLessThanOrEqual(1)
  }

  let top: Draw | null = null
  let topY = Number.POSITIVE_INFINITY
  let bottom: Draw | null = null
  let bottomY = Number.NEGATIVE_INFINITY
  let body: Draw | null = null
  let bodyArea = -1

  for (const draw of draws) {
    const bounds = box(draw)
    if (bounds.minY < topY) {
      topY = bounds.minY
      top = draw
    }
    if (bounds.maxY > bottomY) {
      bottomY = bounds.maxY
      bottom = draw
    }
    // Thân = khối đặc lớn nhất (bỏ bóng/viền: mờ hoặc gần đen).
    if (draw.alpha >= 1 && luma(draw.color) >= SHADOW_LUMA) {
      const area = Math.max(bounds.maxX - bounds.minX, 0) * Math.max(bounds.maxY - bounds.minY, 0)
      if (area > bodyArea) {
        bodyArea = area
        body = draw
      }
    }
  }

  if (top && body && top !== body) {
    const topTone = top.color.toString(16).padStart(6, '0')
    const bodyTone = body.color.toString(16).padStart(6, '0')
    expect(
      luma(top.color),
      `${name}: dải trên #${topTone} phải SÁNG HƠN thân #${bodyTone} (nắng trên-trái)`,
    ).toBeGreaterThan(luma(body.color) + 4)
  }

  expect(
    bottom !== null && (bottom.alpha < 1 || luma(bottom.color) < 60),
    `${name}: thiếu bóng tiếp xúc / viền chân tối`,
  ).toBe(true)
}

describe('art convention (dáng Stardew)', () => {
  it('every decor specimen reads lit top → mid body → dark foot', () => {
    for (const specimen of DECOR_SPECIMENS) {
      const { canvas, draws } = recorder()
      specimen.draw(canvas, 200, 200)
      expectLadder(specimen.label, draws)
    }
  })

  it('keeps the export truck front view an explicit, tread-tyred exception', () => {
    // Ngoại lệ #9 trong AGENTS: view NHÌN THẲNG chỉ dùng ở chặng driveway (khoá ở
    // `gateTruck.test.ts`). Bánh của view này là mặt lốp nên sprite KHÔNG có bánh
    // nan hoa để quay — đúng lỗi "dùng lại asset bánh nan hoa" đã bị báo.
    const front = createTruckFrontSprite(0)
    expect('wheels' in front).toBe(false)
    expect(front.container.children.length).toBeGreaterThanOrEqual(4)
  })
})
