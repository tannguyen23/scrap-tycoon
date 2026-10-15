import { BALANCE } from '@content/balance'
import { GAME_CONTENT } from '@content/index'
import { createFreshState } from '@domain/state'
import { SCRAP_YARD_PACK } from '@ground/packs/scrapYard/pack'
import { validateScenePack, type ScenePack } from '@scene/core/pack'
import { DEFAULT_SERVICES } from '@scene/core/services'
import { chordsAt, createWaterLife, crestDashes, crestLift, swellStrength, type WaterLayer } from '@scene/core/water'
import { CALM_WIND } from '@scenery/core/ambience'
import { buildSceneFeed } from '@ui/scene/feed'
import { createScrapScenePack } from '@ui/scene/scrapPack'
import { Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'

/** Largest per-channel difference — how far apart two colours read. */
function channelDelta(a: number, b: number): number {
  return Math.max(
    Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff)),
    Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff)),
    Math.abs((a & 0xff) - (b & 0xff)),
  )
}

/** The layer the scrap pack hands the kit, or a loud failure. */
function scrapWaterLayer(): WaterLayer {
  const water = createScrapScenePack(GAME_CONTENT).water
  if (!water) throw new Error('the scrap scene pack declares no water')
  return water
}

/** Ray casting — same test the water placement has to survive. */
function insidePolygon(points: readonly number[], x: number, y: number): boolean {
  const count = Math.floor(points.length / 2)
  let inside = false
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = points[i * 2] ?? 0
    const yi = points[i * 2 + 1] ?? 0
    const xj = points[j * 2] ?? 0
    const yj = points[j * 2 + 1] ?? 0
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

describe('scene kit', () => {
  it('binds every layer of the scrap project without wiring errors', () => {
    const pack = createScrapScenePack(GAME_CONTENT)
    expect(validateScenePack(pack)).toEqual([])
    // The seam only works if the pack actually supplies each layer.
    expect(Object.keys(pack.details).length).toBeGreaterThan(0)
    expect(pack.makeCouriers).toBeDefined()
  })

  it('rejects a detail scene keyed on a zone the world does not declare', () => {
    const pack = createScrapScenePack(GAME_CONTENT)
    const broken: ScenePack = {
      ...pack,
      details: {
        ...pack.details,
        nowhere: () => {
          throw new Error('never built — validation must catch this first')
        },
      },
    }
    expect(validateScenePack(broken)).toContain(
      'scene pack "scrapYard" has a detail scene for unknown zone "nowhere"',
    )
  })

  it('feeds the scene from game state, resolving labels in the active locale', () => {
    const pack = createScrapScenePack(GAME_CONTENT)
    const state = createFreshState(GAME_CONTENT, BALANCE.startMoney)
    const vi = buildSceneFeed(GAME_CONTENT, state, 'vi')
    const en = buildSceneFeed(GAME_CONTENT, state, 'en')

    // Every content zone has a readout, and every detail scene can read one.
    expect(Object.keys(vi.zones).sort()).toEqual(Object.keys(GAME_CONTENT.zones).sort())
    for (const zoneId of Object.keys(pack.details)) {
      expect(vi.zones[zoneId], `no feed for detail zone "${zoneId}"`).toBeDefined()
    }

    expect(vi.playTimeS).toBe(state.stats.playTimeS)
    expect(vi.earnedLog10).toBe(0)

    // Wording comes out translated: the same zone reads differently per locale.
    const currency = GAME_CONTENT.items[GAME_CONTENT.currencyItemId]
    expect(vi.zones.alley?.labels.money).toBe(currency?.name.vi)
    expect(en.zones.alley?.labels.money).toBe(currency?.name.en)

    // A zone's head-count is exactly the sum of its per-action counts.
    for (const zone of Object.values(vi.zones)) {
      const summed = Object.values(zone.actions).reduce((total, count) => total + count, 0)
      expect(zone.workers).toBe(summed)
      expect(zone.stock01 === -1 || (zone.stock01 >= 0 && zone.stock01 <= 1)).toBe(true)
    }
  })
})

describe('scene water life', () => {
  it('clips every crest to the water, so no swell ever breaks on the bank', () => {
    const bodies = scrapWaterLayer().bodies
    expect(bodies.length).toBeGreaterThan(0)

    let spans = 0
    for (const body of bodies) {
      let minY = Number.POSITIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      for (let i = 1; i < body.contour.length; i += 2) {
        const y = body.contour[i] ?? 0
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
      // Whole rows only — a crest is always drawn on a rounded pixel.
      for (let y = Math.floor(minY) - 2; y <= Math.ceil(maxY) + 2; y++) {
        for (const span of chordsAt(body.contour, y)) {
          spans++
          // A crest draws from x0+1 to x1-1, so those have to be on the water.
          if (span.x1 - span.x0 < 4) continue
          expect(insidePolygon(body.contour, span.x0 + 1, y), `left end of row ${y}`).toBe(true)
          expect(insidePolygon(body.contour, span.x1 - 1, y), `right end of row ${y}`).toBe(true)
        }
      }
    }
    expect(spans).toBeGreaterThan(50)
  })

  it('comes in sets: the swell builds, releases, and never dies out completely', () => {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (let phase = 0; phase < Math.PI * 4; phase += 0.02) {
      const strength = swellStrength(phase)
      min = Math.min(min, strength)
      max = Math.max(max, strength)
    }
    // A floor well above zero: the water keeps moving between sets.
    expect(min).toBeGreaterThan(0.2)
    expect(max).toBeCloseTo(1, 3)
    // Periodic, so a set is a set and not a one-off.
    expect(swellStrength(0.4)).toBeCloseTo(swellStrength(0.4 + Math.PI * 2), 6)
  })

  it('sloshes: every crest bounces off the far shore instead of teleporting back', () => {
    const life = createWaterLife(scrapWaterLayer(), DEFAULT_SERVICES)
    const prevY = new Map<Graphics, number>()
    const prevDir = new Map<Graphics, number>()
    let reversals = 0
    let steps = 0

    for (let i = 0; i < 2400; i++) {
      life.update(1 / 60, CALM_WIND)
      for (const node of life.container.children) {
        // Fish are plain containers; a crest is the Graphics one.
        if (!(node instanceof Graphics)) continue
        const before = prevY.get(node)
        prevY.set(node, node.y)
        if (before === undefined) continue
        const delta = node.y - before
        if (delta === 0) continue
        steps++
        const dir = delta > 0 ? 1 : -1
        const was = prevDir.get(node)
        prevDir.set(node, dir)
        if (was !== undefined && was !== dir) reversals++
      }
    }

    // 40 seconds of sloshing: every crest has to have turned around several times.
    expect(reversals).toBeGreaterThan(10)
    expect(steps).toBeGreaterThan(500)
  })

  it('keeps every fish under the water while it swims', () => {
    const layer = scrapWaterLayer()
    const life = createWaterLife(layer, DEFAULT_SERVICES)
    const fish = life.container.children.filter((node) => !(node instanceof Graphics))
    expect(fish.length).toBeGreaterThan(0)

    let checked = 0
    for (let i = 0; i < 1800; i++) {
      life.update(1 / 60, CALM_WIND)
      if (i % 11 !== 0) continue
      for (const node of fish) {
        const inside = layer.bodies.some((body) => insidePolygon(body.contour, node.x, node.y))
        expect(inside, `fish at ${node.x},${node.y} left the water`).toBe(true)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(500)
  })

  it('keeps a fixed pool, sane alphas, and water that is never dead', () => {
    const life = createWaterLife(scrapWaterLayer(), DEFAULT_SERVICES)
    const pools = life.container.children.length
    expect(pools).toBeGreaterThan(0)
    const gale = { x: 0.95, y: 0.2, strength: 2 }

    let dimmest = Number.POSITIVE_INFINITY
    for (let i = 0; i < 600; i++) {
      life.update(1 / 60, i % 200 < 100 ? CALM_WIND : gale)
      let lit = 0
      for (const node of life.container.children) {
        expect(Number.isFinite(node.y)).toBe(true)
        expect(node.alpha).toBeGreaterThan(0)
        expect(node.alpha).toBeLessThanOrEqual(1)
        if (node.alpha > 0.05) lit++
      }
      dimmest = Math.min(dimmest, lit)
      // Pools are fixed: the layer never grows a node per frame.
      expect(life.container.children.length).toBe(pools)
    }
    expect(dimmest).toBeGreaterThan(0)
  })

  it('rides in the water\'s own tone — visible, but never a white bar', () => {
    const layer = scrapWaterLayer()
    const terrain = SCRAP_YARD_PACK.terrains.find((candidate) => candidate.id === 'water')
    expect(terrain).toBeDefined()

    // Below ~30/255 the crest vanishes into the surface; above ~80/255 it reads as
    // a white bar laid over the pond. Both have been reported.
    for (const base of terrain?.bases ?? []) {
      const delta = channelDelta(layer.crest, base)
      expect(delta, `crest ${layer.crest.toString(16)} vs base ${base.toString(16)}`).toBeGreaterThanOrEqual(30)
      expect(delta).toBeLessThanOrEqual(80)
    }
  })

  it('takes its waterlines from the map data, never a second copy', () => {
    const bodies = scrapWaterLayer().bodies
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) {
      // At least 3 points, and every vertex inside the world the camera clamps to.
      expect(body.contour.length).toBeGreaterThanOrEqual(6)
      for (let i = 0; i < body.contour.length; i += 2) {
        expect(body.contour[i]).toBeGreaterThan(0)
        expect(body.contour[i]).toBeLessThan(1280)
        expect(body.contour[i + 1]).toBeGreaterThan(0)
        expect(body.contour[i + 1]).toBeLessThan(720)
      }
    }
  })

  it('draws every crest onto its pond, never on the grass around it', () => {
    const layer = scrapWaterLayer()
    const life = createWaterLife(layer, DEFAULT_SERVICES)

    // The coarse guard: a crest offset by its own row (the reported bug) lands a
    // whole pond-height below the water, which this catches at a glance.
    const extent = (node: { y: number }) => node.y
    const tops = layer.bodies.map((body) => Math.min(...body.contour.filter((_v, i) => i % 2 === 1)))
    const bottoms = layer.bodies.map((body) => Math.max(...body.contour.filter((_v, i) => i % 2 === 1)))
    const waterTop = Math.min(...tops)
    const waterBottom = Math.max(...bottoms)

    for (let i = 0; i < 420; i++) {
      life.update(1 / 60, CALM_WIND)
      if (i % 7 !== 0) continue
      for (const node of life.container.children) {
        const box = node.getBounds()
        if (box.width === 0 && box.height === 0) continue
        expect(box.minY, `crest at row ${extent(node)} drew up at ${box.minY}`).toBeGreaterThanOrEqual(waterTop)
        expect(box.maxY, `crest at row ${extent(node)} drew down at ${box.maxY}`).toBeLessThanOrEqual(waterBottom)
      }
    }
    expect(waterBottom - waterTop).toBeGreaterThan(100)
  })

  it('clips each dash at its own row, so a slanted crest never leaves the water', () => {
    const layer = scrapWaterLayer()
    const plan = { shape: 1.1, slope: 0.22, salt: 77 }

    let checked = 0
    for (const body of layer.bodies) {
      const rows = body.contour.filter((_v, i) => i % 2 === 1)
      const minY = Math.min(...rows)
      const maxY = Math.max(...rows)
      for (let row = Math.floor(minY); row <= Math.ceil(maxY); row += 3) {
        for (const dash of crestDashes(body, row, plan)) {
          // Both ends of the dash lie on the water at the dash's OWN row — a tilted
          // crest walks off the shore long before its nominal row does.
          expect(insidePolygon(body.contour, dash.x, dash.y), `head of dash at ${dash.x},${dash.y}`).toBe(true)
          const tail = dash.x + dash.length - 1
          expect(insidePolygon(body.contour, tail, dash.y), `tail at ${tail},${dash.y}`).toBe(true)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(150)
  })

  it('leans its crests instead of laying them level', () => {
    const body = scrapWaterLayer().bodies[0]
    if (!body) throw new Error('the scrap pack declares no water')

    const row = Math.round(body.center.y)
    const level = crestDashes(body, row, { shape: 0.7, slope: 0, salt: 5 })
    const tilted = crestDashes(body, row, { shape: 0.7, slope: 0.22, salt: 5 })
    expect(level.length).toBeGreaterThan(2)
    expect(tilted.length).toBeGreaterThan(2)

    // The same crest, only tilted: its low end has to sit well below the level one.
    expect(Math.max(...tilted.map((dash) => dash.y))).toBeGreaterThan(
      Math.max(...level.map((dash) => dash.y)) + 5,
    )
  })

  it('undulates along its length instead of drawing a flat ruler', () => {
    // The crest has to rise and dip across the pond — a level line is exactly what
    // got reported. 190px covers the widest pond.
    const lifts: number[] = []
    for (let x = 0; x < 190; x += 3) lifts.push(crestLift(x, 1.2))
    const spread = Math.max(...lifts) - Math.min(...lifts)
    expect(spread).toBeGreaterThanOrEqual(3)

    // And it stays smooth: a crest that steps between rows reads as a zigzag.
    for (let i = 1; i < lifts.length; i++) {
      expect(Math.abs((lifts[i] ?? 0) - (lifts[i - 1] ?? 0))).toBeLessThanOrEqual(1)
    }

    // Each crest gets its own shape phase, so a pond is never one ribbed sheet.
    expect(crestLift(40, 0)).not.toBe(crestLift(40, Math.PI / 2))
  })

  it('is a quiet no-op when the project has no water', () => {
    const life = createWaterLife({ bodies: [], crest: 0xffffff, fish: 0x000000 }, DEFAULT_SERVICES)
    expect(life.container.children.length).toBe(0)
    expect(() => life.update(1 / 60, CALM_WIND)).not.toThrow()
  })
})
