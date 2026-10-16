import type { GroundMap } from '@ground/core/grounds'
import { planChunkCalls } from '@ground/core/grounds'
import { chunkKey, chunkRect, chunksForView } from '@scene/core/chunks'
import { describe, expect, it } from 'vitest'

/** A tiny data map with one of everything, so the planner is tested without a renderer. */
const MAP: GroundMap = {
  width: 2048,
  height: 1024,
  base: 'grass',
  baseSeed: 1,
  patchworkSeed: 2,
  floraSeed: 3,
  lanes: [{ rect: { x: 100, y: 100, width: 200, height: 60 }, kind: 'dirt', seed: 4, outside: 'grass' }],
  floors: [{ rect: { x: 900, y: 200, width: 128, height: 128 }, kind: 'dirt', seed: 5, pad: 20 }],
  clearings: [{ rect: { x: 1500, y: 700, width: 200, height: 160 }, seed: 6 }],
  traces: [{ kind: 'wear', points: [{ x: 320, y: 130 }, { x: 480, y: 132 }], seed: 7, strength: 0.8 }],
  connectors: {
    rects: [
      { x: 0, y: 500, width: 2048, height: 48 },
      { x: 1700, y: 0, width: 48, height: 1024 },
    ],
    kind: 'asphalt',
    seedBase: 10,
  },
  links: [{ rect: { x: 700, y: 60, width: 100, height: 40 }, kind: 'dirt', seed: 8, outside: 'grass' }],
  debrisSeed: 9,
  water: [{ rect: { x: 1200, y: 750, width: 120, height: 90 }, seed: 11 }],
}

describe('chunk grid', () => {
  const world = { width: 10240, height: 5760 }

  it('covers the view, grows by the margin, and clamps to the world', () => {
    expect(chunksForView({ x: 0, y: 0, width: 1000, height: 700 }, 1024, world, 0)).toEqual([{ cx: 0, cy: 0 }])

    // A view straddling a chunk edge pulls in both cells on each axis…
    const straddle = chunksForView({ x: 1900, y: 1900, width: 400, height: 300 }, 1024, world, 0)
    expect(straddle.length).toBe(4)

    // …and one cell of margin grows the ring around it (4×4 away from the edges).
    expect(chunksForView({ x: 1900, y: 1900, width: 400, height: 300 }, 1024, world, 1).length).toBe(16)

    // Clamped: never a negative index, never past the last cell.
    for (const cell of chunksForView({ x: -500, y: -500, width: 100, height: 100 }, 1024, world, 1)) {
      expect(cell.cx).toBeGreaterThanOrEqual(0)
      expect(cell.cy).toBeGreaterThanOrEqual(0)
    }
    const last = chunksForView({ x: 10230, y: 5750, width: 10, height: 10 }, 1024, world, 1)
    expect(Math.max(...last.map((cell) => cell.cx))).toBe(9)
    expect(Math.max(...last.map((cell) => cell.cy))).toBe(5)
  })

  it('keeps keys and rects stable', () => {
    expect(chunkKey(3, 2)).toBe('3,2')
    expect(chunkRect(1, 2, 1024)).toEqual({ x: 1024, y: 2048, width: 1024, height: 1024 })
  })
})

describe('chunk paint plan', () => {
  it('plans the whole map when there is no window', () => {
    const plan = planChunkCalls(MAP)
    expect(plan.base).toEqual({ x: 0, y: 0, width: 2048, height: 1024 })
    expect(plan.lanes.length).toBe(1)
    expect(plan.floors.length).toBe(1)
    expect(plan.clearings.length).toBe(1)
    expect(plan.traces.length).toBe(1)
    expect(plan.connectors.length).toBe(2)
    expect(plan.links.length).toBe(1)
    expect(plan.water.length).toBe(1)
    // Connector seeds are their map index, so nothing may renumber them.
    expect(plan.connectors.map((entry) => entry.seed)).toEqual([10, 11])
  })

  it('keeps only the calls a window reaches — and never renumbers connector seeds', () => {
    const plan = planChunkCalls(MAP, { x: 0, y: 0, width: 420, height: 420 })
    expect(plan.base).toEqual({ x: 0, y: 0, width: 420, height: 420 })
    // The lane and the trace live inside the window…
    expect(plan.lanes.length).toBe(1)
    expect(plan.traces.length).toBe(1)
    // …while the floor, the link, the clearing and the pond are far outside it.
    expect(plan.floors.length).toBe(0)
    expect(plan.links.length).toBe(0)
    expect(plan.clearings.length).toBe(0)
    expect(plan.water.length).toBe(0)
    expect(plan.connectors.length).toBe(0)

    // A window on the second connector only: the seed still says "map index 1".
    const east = planChunkCalls(MAP, { x: 1600, y: 0, width: 128, height: 256 })
    expect(east.connectors).toEqual([{ rect: MAP.connectors.rects[1], seed: 11 }])
  })

  it('clips the base to the map and plans nothing for a window outside it', () => {
    const plan = planChunkCalls(MAP, { x: 2000, y: 0, width: 400, height: 400 })
    expect(plan.base).toEqual({ x: 2000, y: 0, width: 48, height: 400 })
    expect(plan.lanes.length).toBe(0)
    expect(plan.floors.length).toBe(0)
    expect(plan.water.length).toBe(0)

    const outside = planChunkCalls(MAP, { x: 4000, y: 4000, width: 128, height: 128 })
    expect(outside.base.width).toBe(0)
    expect(outside.connectors.length).toBe(0)
  })

  it('gives a window a margin of reach, so art spilling past a rect is caught', () => {
    // The lane ends at x = 300; a window starting just past it must still plan it
    // (fringe and litter reach outside the rect).
    const plan = planChunkCalls(MAP, { x: 310, y: 60, width: 64, height: 64 })
    expect(plan.lanes.length).toBe(1)
  })
})
