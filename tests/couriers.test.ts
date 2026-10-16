import { GAME_CONTENT } from '@content/index'
import {
  COURIER_GROUND,
  COURIER_RUNS,
  courierLegsFor,
  createCouriers,
  createDriveCourier,
  createWalkerCourier,
} from '@ui/scene/couriers'
import { Particles } from '@ui/scene/focus/parts'
import {
  AVENUE_HEIGHT,
  AVENUE_Y,
  DEPOT_DRIVEWAY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
  insideAnyRect,
  type ZoneRect,
} from '@ground/packs/scrapYard/worldLayout'
import type { SceneFeed } from '@scene/core/feed'
import { describe, expect, it } from 'vitest'

const VIEW_ALL: ZoneRect = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }

/** Everything a courier may stand on: yards, painted links, the avenue. */
const GROUND: ZoneRect[] = [...Object.values(ZONE_LAYOUTS).map((layout) => layout.rect), ...COURIER_GROUND]

/** A feed carrying only what the courier layer reads. */
function feed(workers: Record<string, number>): SceneFeed {
  return { playTimeS: 0, earnedLog10: 0, zones: {}, workers }
}

describe('courier layer', () => {
  it('crews a run up to its cap and hides everyone at zero workers', () => {
    const couriers = createCouriers(courierLegsFor(GAME_CONTENT))
    couriers.setFeed(feed({ porter: 10 }))
    couriers.update(1 / 60, VIEW_ALL)
    expect(couriers.crewSize('alley', 'recycle')).toBe(3)

    couriers.setFeed(feed({}))
    couriers.update(1 / 60, VIEW_ALL)
    expect(couriers.crewSize('alley', 'recycle')).toBe(0)
  })

  it('spawns nothing for the export truck leg (its delivery is leaving the map)', () => {
    const couriers = createCouriers(courierLegsFor(GAME_CONTENT))
    couriers.setFeed(feed({ truck: 3, scavenger: 2 }))
    couriers.update(1 / 60, VIEW_ALL)
    // Only the shared particle layer — no courier run exists for the truck.
    expect(couriers.root.children.length).toBe(1)
  })

  it('freezes runs whose bounds left the view', () => {
    const couriers = createCouriers(courierLegsFor(GAME_CONTENT))
    couriers.setFeed(feed({ porter: 1 }))

    // A view far from the core sees no crew…
    couriers.update(1 / 60, { x: 100, y: 5000, width: 200, height: 200 })
    expect(couriers.crewSize('alley', 'recycle')).toBe(0)

    // …and the core’s view brings them back.
    couriers.update(1 / 60, { x: 3904, y: 2104, width: 1280, height: 720 })
    expect(couriers.crewSize('alley', 'recycle')).toBe(1)
  })
})

describe('cart run (alley → forge)', () => {
  it('trundles the dirt path both ways with its nose pointing where it goes', () => {
    const run = COURIER_RUNS['alley>recycle']
    if (!run) throw new Error('missing the alley>recycle run')
    expect(run.kind).toBe('drive')
    const cart = createDriveCourier(run, run.vehicle ?? 0, 0)
    const particles = new Particles()

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let previousX = cart.container.x
    let sawEast = false
    let sawWest = false

    for (let frame = 0; frame < 60 * 120; frame++) {
      cart.update(1 / 60, particles)
      particles.update(1 / 60)
      const { x, y } = cart.container
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      // Hướng mặt khớp chiều đi: chạy về đông thì +1, về tây thì −1.
      const dx = x - previousX
      previousX = x
      if (Math.abs(dx) > 0.05) {
        expect(Math.sign(cart.container.scale.x)).toBe(Math.sign(dx))
        if (dx > 0) sawEast = true
        else sawWest = true
      }
    }

    expect(sawEast).toBe(true)
    expect(sawWest).toBe(true)
    // The whole round trip stays on the dirt path (worldGrounds lane 4240..5120).
    expect(minX).toBeGreaterThanOrEqual(4240)
    expect(maxX).toBeLessThanOrEqual(5170)
    expect(minY).toBeGreaterThanOrEqual(2196)
    expect(maxY).toBeLessThanOrEqual(2244)
  })
})

describe('pallet run (route → depot)', () => {
  it('carries pallets on foot down the driveway — no vehicle slides sideways', () => {
    const run = COURIER_RUNS['route>depot']
    if (!run) throw new Error('missing the route>depot run')
    // Driveway là đường dọc: art xe chỉ có hướng đông-tây nên chặng này phải đi bộ.
    expect(run.kind).toBe('walk')
    const walker = createWalkerCourier(run, 0)
    const particles = new Particles()
    const avenue: ZoneRect = { x: 0, y: AVENUE_Y, width: WORLD_WIDTH, height: AVENUE_HEIGHT }
    if (!ZONE_LAYOUTS['depot']) throw new Error('missing depot layout data')

    let reachedDepot = false
    let reachedRoad = false
    let carried = false

    for (let frame = 0; frame < 60 * 200; frame++) {
      walker.update(1 / 60, particles)
      particles.update(1 / 60)
      const { x, y } = walker.container
      expect(
        insideAnyRect([avenue, DEPOT_DRIVEWAY, ZONE_LAYOUTS['depot'].rect], x, y),
        `pallet carrier left the lane at ${x},${y}`,
      ).toBe(true)
      if (walker.cargo.visible) carried = true
      if (y > 3000) reachedDepot = true
      if (x > 5000 && y < AVENUE_Y + AVENUE_HEIGHT) reachedRoad = true
    }

    expect(carried).toBe(true)
    expect(reachedDepot).toBe(true)
    expect(reachedRoad).toBe(true)
  })
})

describe('crate run (depot → gate)', () => {
  it('carries the crate to the gate stack without leaving painted ground', () => {
    const run = COURIER_RUNS['depot>gate']
    if (!run) throw new Error('missing the depot>gate run')
    const walker = createWalkerCourier(run, 0)
    const particles = new Particles()

    let reachedGate = false
    let carriedEastbound = false

    for (let frame = 0; frame < 60 * 260; frame++) {
      walker.update(1 / 60, particles)
      particles.update(1 / 60)
      const { x, y } = walker.container
      expect(insideAnyRect(GROUND, x, y), `crate carrier left painted ground at ${x},${y}`).toBe(true)
      if (x > 6300 && y > 3010) reachedGate = true
      if (walker.cargo.visible && x > 5200) carriedEastbound = true
    }

    expect(reachedGate).toBe(true)
    expect(carriedEastbound).toBe(true)
  })
})

describe('courier paths', () => {
  it('stay on painted ground (zones, connectors, the avenue, the alley-forge lane)', () => {
    for (const run of Object.values(COURIER_RUNS)) {
      for (let i = 0; i + 1 < run.path.length; i++) {
        const a = run.path[i]
        const b = run.path[i + 1]
        if (!a || !b) continue
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4)
        for (let step = 0; step <= steps; step++) {
          const t = steps === 0 ? 0 : step / steps
          const x = a.x + (b.x - a.x) * t
          const y = a.y + (b.y - a.y) * t
          expect(insideAnyRect(GROUND, x, y), `a ${run.kind} path leaves painted ground at ${x},${y}`).toBe(true)
        }
      }
    }
  })
})
