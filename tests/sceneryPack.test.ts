import { describe, expect, it } from 'vitest'
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
    expect(ambience.container.children.length).toBe(2)

    const micro = createDetailLayer(SCRAP_SCENERY.microProps, SCRAP_SCENERY.drawMicro)
    expect(micro.children.length).toBe(1)
    expect(SCRAP_SCENERY.microProps.length).toBeGreaterThan(0)
    expect(SCRAP_SCENERY.nanoProps.length).toBeGreaterThan(0)
  })

  it('keeps the day grade inside sane bounds', () => {
    for (let i = 0; i <= 20; i++) {
      const sample = sampleAmbient(i / 20)
      expect(sample.alpha).toBeGreaterThanOrEqual(0)
      expect(sample.alpha).toBeLessThanOrEqual(1)
    }
  })
})
