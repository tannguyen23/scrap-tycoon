import { describe, expect, it } from 'vitest'
import { createAlleyLife, createFlySwarm } from '@ui/scene/focus/alley/life'
import {
  drawBottle,
  drawGreenBin,
  drawTippedBin,
  drawTrashBag,
} from '@ui/scene/focus/alley/sprites'
import type { Spot } from '@ui/scene/focus/types'
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

const ANCHOR = { x: 100, y: 100 }

interface LitterCase {
  name: string
  minDraws: number
  half: number
  top: number
  bottom: number
  draw: (g: GroundCanvas) => void
}

const LITTER_CASES: LitterCase[] = [
  {
    name: 'thùng nhựa xanh (nắp đóng)',
    minDraws: 8,
    half: 12.5,
    top: 25,
    bottom: 6,
    draw: (g) => drawGreenBin(g, ANCHOR.x, ANCHOR.y),
  },
  {
    name: 'thùng nhựa xanh (nắp mở)',
    minDraws: 10,
    half: 12.5,
    top: 28.5,
    bottom: 6,
    draw: (g) => drawGreenBin(g, ANCHOR.x, ANCHOR.y, true),
  },
  {
    name: 'thùng rác đổ nghiêng',
    minDraws: 10,
    half: 15.5,
    top: 14,
    bottom: 5,
    draw: (g) => drawTippedBin(g, ANCHOR.x, ANCHOR.y),
  },
]

for (const r of [4.5, 5.5]) {
  LITTER_CASES.push({
    name: `bao rác vứt lẻ r${r}`,
    minDraws: 5,
    half: r + 2.6,
    top: r * 2.2,
    bottom: 5,
    draw: (g) => drawTrashBag(g, ANCHOR.x, ANCHOR.y, r),
  })
}

for (let tone = 0; tone < 3; tone++) {
  LITTER_CASES.push({
    name: `chai nằm tông ${tone}`,
    minDraws: 5,
    half: 6.5,
    top: 3,
    bottom: 2.5,
    draw: (g) => drawBottle(g, ANCHOR.x, ANCHOR.y, tone, true),
  })
  LITTER_CASES.push({
    name: `chai chống tông ${tone}`,
    minDraws: 5,
    half: 2.5,
    top: 6.5,
    bottom: 2.5,
    draw: (g) => drawBottle(g, ANCHOR.x, ANCHOR.y, tone, false),
  })
}

describe('alley litter props', () => {
  for (const entry of LITTER_CASES) {
    it(`${entry.name}: art stays inside its footprint`, () => {
      const { canvas, draws } = recorder()
      entry.draw(canvas)
      expect(draws.length, entry.name).toBeGreaterThanOrEqual(entry.minDraws)
      for (const draw of draws) {
        expect(draw.alpha, entry.name).toBeGreaterThan(0)
        expect(draw.alpha, entry.name).toBeLessThanOrEqual(1)
        const box = extents(draw)
        expect(box.minX, `${entry.name} minX`).toBeGreaterThanOrEqual(ANCHOR.x - entry.half)
        expect(box.maxX, `${entry.name} maxX`).toBeLessThanOrEqual(ANCHOR.x + entry.half)
        expect(box.minY, `${entry.name} minY`).toBeGreaterThanOrEqual(ANCHOR.y - entry.top)
        expect(box.maxY, `${entry.name} maxY`).toBeLessThanOrEqual(ANCHOR.y + entry.bottom)
      }
    })
  }
})

const FLY_ANCHORS: Spot[] = [
  { x: 40, y: 50 },
  { x: 170, y: 70 },
  { x: 90, y: 170 },
]

describe('fly swarm', () => {
  it('wanders between the trash spots and never leaves the yard', () => {
    const swarm = createFlySwarm(FLY_ANCHORS, 4)
    expect(swarm.container.children.length).toBe(4)

    const start = swarm.container.children.map((child) => ({ x: child.x, y: child.y }))
    let previous = start
    const flights = swarm.container.children.map(() => 0)
    const drift = swarm.container.children.map(() => 0)

    for (let frame = 1; frame <= 60 * 45; frame++) {
      swarm.update(1 / 60, frame / 60)
      swarm.container.children.forEach((child, index) => {
        const last = previous[index]
        const origin = start[index]
        if (last) {
          flights[index] = (flights[index] ?? 0) + Math.hypot(child.x - last.x, child.y - last.y)
        }
        if (origin) {
          drift[index] = Math.max(drift[index] ?? 0, Math.hypot(child.x - origin.x, child.y - origin.y))
        }
        // The swarm stays in the litter neighbourhood: anchors ± their offsets,
        // no strays drifting off into the rest of the zone.
        expect(child.x, `fly ${index} x`).toBeGreaterThanOrEqual(30)
        expect(child.x, `fly ${index} x`).toBeLessThanOrEqual(180)
        expect(child.y, `fly ${index} y`).toBeGreaterThanOrEqual(40)
        expect(child.y, `fly ${index} y`).toBeLessThanOrEqual(180)
      })
      previous = swarm.container.children.map((child) => ({ x: child.x, y: child.y }))
    }

    for (const distance of flights) {
      expect(distance, 'path length').toBeGreaterThan(60)
    }
    expect(drift.filter((distance) => distance > 30).length).toBeGreaterThanOrEqual(2)
  })

  it('runs the yard life with litter anchors without blowing up', () => {
    const life = createAlleyLife(
      [
        { x: 34, y: 56 },
        { x: 118, y: 46 },
      ],
      [
        { x: 238, y: 96 },
        { x: 140, y: 210 },
      ],
    )
    for (let frame = 0; frame < 60 * 20; frame++) {
      life.update(1 / 60, frame / 60)
    }
    expect(life.container.children.length).toBeGreaterThan(4)
  })
})
