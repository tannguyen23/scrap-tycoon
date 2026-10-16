import { describe, expect, it } from 'vitest'
import { insideAnyRect } from '@ground/core/metrics'
import { WATER_AREAS, ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import { CALM_WIND, createAmbience } from '@scenery/core/ambience'
import { createDetailLayer } from '@scenery/core/details'
import { DAY_LENGTH_SECONDS, createLighting, sampleAmbient } from '@scenery/core/lighting'
import { validateSceneryPack } from '@scenery/core/pack'
import { SCRAP_SCENERY } from '@scenery/packs/scrapYard/pack'

describe('scenery kit', () => {
  it('builds every layer from the project pack', () => {
    expect(validateSceneryPack(SCRAP_SCENERY)).toEqual([])

    const lighting = createLighting({ width: 1280, height: 720 }, SCRAP_SCENERY.lights)
    expect(lighting.container.children.length).toBe(1 + SCRAP_SCENERY.lights.length)
    lighting.update(DAY_LENGTH_SECONDS / 4)
    expect(Number.isFinite(lighting.getTime())).toBe(true)

    const ambience = createAmbience(SCRAP_SCENERY.ambience)
    for (let i = 0; i < 120; i++) ambience.update(1 / 60, CALM_WIND)
    // Ground birds, smoke and the sky lanes are three separate layers.
    expect(ambience.container.children.length).toBe(3)

    const micro = createDetailLayer(SCRAP_SCENERY.microProps, SCRAP_SCENERY.drawMicro)
    // Props are bucketed for view culling: at least one bucket, each with art.
    expect(micro.container.children.length).toBeGreaterThan(0)
    expect(SCRAP_SCENERY.microProps.length).toBeGreaterThan(0)
    expect(SCRAP_SCENERY.nanoProps.length).toBeGreaterThan(0)

    // A view sees the buckets that reach into it and nothing else: centred on one
    // prop, its bucket is visible while the far side of the map stays hidden.
    const probe = SCRAP_SCENERY.microProps[0]
    if (!probe) throw new Error('the scenery pack has no micro props')
    micro.update({ x: probe.x - 16, y: probe.y - 16, width: 32, height: 32 })
    expect(micro.container.children.some((bucket) => bucket.visible)).toBe(true)
    expect(micro.container.children.some((bucket) => !bucket.visible)).toBe(true)
  })

  it('dresses the open ground too, and never floats litter on a pond', () => {
    const zones = Object.values(ZONE_LAYOUTS).map((layout) => layout.rect)
    const ponds = WATER_AREAS.map((area) => area.rect)
    const all = [...SCRAP_SCENERY.microProps, ...SCRAP_SCENERY.nanoProps]

    // Zooming into the middle of the map used to reveal nothing at all: the props
    // stopped at the zone borders, which the player cannot even see.
    const outsideZones = all.filter((prop) => !insideAnyRect(zones, prop.x, prop.y))
    expect(outsideZones.length).toBeGreaterThan(100)

    // And none of them may land on water, where a nail would read as floating.
    for (const prop of all) {
      expect(insideAnyRect(ponds, prop.x, prop.y), `prop at ${prop.x},${prop.y} is on a pond`).toBe(false)
    }
  })

  it('keeps ground birds on their patch, and never on a pond', () => {
    const ambience = createAmbience(SCRAP_SCENERY.ambience)
    const ground = ambience.container.children[0]
    if (!ground) throw new Error('the ambience has no ground layer')
    const birds = ground.children
    expect(birds.length).toBeGreaterThan(0)

    const homes = birds.map((node) => ({ x: node.x, y: node.y }))
    const ponds = WATER_AREAS.map((area) => area.rect)
    const airborne = new Set<number>()

    for (let i = 0; i < 2400; i++) {
      ambience.update(1 / 60, CALM_WIND)
      if (i % 5 !== 0) continue
      birds.forEach((node, index) => {
        const home = homes[index]
        if (!home) return
        // Never off its patch: the landing spot is always inside the radius, and
        // the take-off arc only adds height.
        expect(Math.abs(node.x - home.x), `bird ${index} strayed on x`).toBeLessThanOrEqual(20)
        expect(Math.abs(node.y - home.y), `bird ${index} strayed on y`).toBeLessThanOrEqual(30)
        expect(insideAnyRect(ponds, node.x, node.y), `bird ${index} is on a pond`).toBe(false)
        if (Math.abs(node.y - home.y) > 3) airborne.add(index)
      })
    }
    // And they do take off, or they are just dots on the grass.
    expect(airborne.size).toBeGreaterThan(0)
  })

  it('keeps the day grade inside sane bounds', () => {
    for (let i = 0; i <= 20; i++) {
      const sample = sampleAmbient(i / 20)
      expect(sample.alpha).toBeGreaterThanOrEqual(0)
      expect(sample.alpha).toBeLessThanOrEqual(1)
    }
  })
})
