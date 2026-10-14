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
import { CONNECTORS, ZONE_LAYOUTS, insideAnyRect, type ZoneRect } from '@ui/scene/zoneLayout'
import { describe, expect, it } from 'vitest'

const VIEW_ALL: ZoneRect = { x: 0, y: 0, width: 1280, height: 720 }

describe('courier layer', () => {
  it('crews a run up to its cap and hides everyone at zero workers', () => {
    const couriers = createCouriers(courierLegsFor(GAME_CONTENT))
    couriers.setCounts({ workers: new Map([['porter', 10]]), tiers: new Map() })
    couriers.update(1 / 60, VIEW_ALL)
    expect(couriers.crewSize('alley', 'recycle')).toBe(3)

    couriers.setCounts({ workers: new Map(), tiers: new Map() })
    couriers.update(1 / 60, VIEW_ALL)
    expect(couriers.crewSize('alley', 'recycle')).toBe(0)
  })

  it('spawns nothing for the export truck leg (its delivery is leaving the map)', () => {
    const couriers = createCouriers(courierLegsFor(GAME_CONTENT))
    couriers.setCounts({ workers: new Map([['truck', 3], ['scavenger', 2]]), tiers: new Map() })
    couriers.update(1 / 60, VIEW_ALL)
    // Only the shared particle layer — no courier run exists for the truck.
    expect(couriers.root.children.length).toBe(1)
  })

  it('freezes runs whose bounds left the view', () => {
    const couriers = createCouriers(courierLegsFor(GAME_CONTENT))
    couriers.setCounts({ workers: new Map([['porter', 1]]), tiers: new Map() })

    couriers.update(1 / 60, { x: 900, y: 300, width: 100, height: 100 })
    expect(couriers.crewSize('alley', 'recycle')).toBe(0)

    couriers.update(1 / 60, VIEW_ALL)
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

    for (let frame = 0; frame < 60 * 90; frame++) {
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
    // The whole round trip stays on the dirt path.
    expect(minX).toBeGreaterThanOrEqual(384)
    expect(maxX).toBeLessThanOrEqual(652)
    expect(minY).toBeGreaterThanOrEqual(100)
    expect(maxY).toBeLessThanOrEqual(148)
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
    const road = ZONE_LAYOUTS['route']?.rect
    const driveway = CONNECTORS[0]
    const depot = ZONE_LAYOUTS['depot']?.rect
    if (!road || !driveway || !depot) throw new Error('missing route layout data')

    let reachedDepot = false
    let reachedRoad = false
    let carried = false

    for (let frame = 0; frame < 60 * 90; frame++) {
      walker.update(1 / 60, particles)
      particles.update(1 / 60)
      const { x, y } = walker.container
      expect(insideAnyRect([road, driveway, depot], x, y), `pallet carrier left the lane at ${x},${y}`).toBe(true)
      if (walker.cargo.visible) carried = true
      if (y > 540) reachedDepot = true
      if (x > 700 && y < 430) reachedRoad = true
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
    const ground: ZoneRect[] = [
      ...Object.values(ZONE_LAYOUTS).map((layout) => layout.rect),
      ...COURIER_GROUND,
    ]

    let reachedGate = false
    let carriedEastbound = false

    for (let frame = 0; frame < 60 * 120; frame++) {
      walker.update(1 / 60, particles)
      particles.update(1 / 60)
      const { x, y } = walker.container
      expect(insideAnyRect(ground, x, y), `crate carrier left painted ground at ${x},${y}`).toBe(true)
      if (x > 930 && y > 540) reachedGate = true
      if (walker.cargo.visible && x > 500) carriedEastbound = true
    }

    expect(reachedGate).toBe(true)
    expect(carriedEastbound).toBe(true)
  })
})

describe('courier paths', () => {
  it('stay on painted ground (zones, connectors, the alley-forge dirt path)', () => {
    const ground: ZoneRect[] = [
      ...Object.values(ZONE_LAYOUTS).map((layout) => layout.rect),
      ...COURIER_GROUND,
    ]

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
          expect(insideAnyRect(ground, x, y), `a ${run.kind} path leaves painted ground at ${x},${y}`).toBe(true)
        }
      }
    }
  })
})
