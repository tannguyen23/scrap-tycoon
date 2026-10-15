import type { WeatherVisual } from '@domain/types'
import { CALM_WIND } from '@scenery/core/ambience'
import { cloudRuns, mixWeatherVisual, pickPondSpot } from '@ui/scene/weather'
import { WATER_AREAS } from '@ground/packs/scrapYard/worldLayout'
import { describe, expect, it } from 'vitest'

describe('weather visuals', () => {
  it('generates deterministic cloud runs inside the declared box', () => {
    const runs = cloudRuns(42, 72, 26)
    expect(runs.length).toBeGreaterThan(0)
    expect(cloudRuns(42, 72, 26)).toEqual(runs)

    let sawShade = false
    for (const run of runs) {
      expect(run.x).toBeGreaterThanOrEqual(0)
      expect(run.y).toBeGreaterThanOrEqual(0)
      expect(run.width).toBeGreaterThan(0)
      expect(run.width % 2).toBe(0)
      expect(run.x + run.width).toBeLessThanOrEqual(72)
      expect(run.y + run.height).toBeLessThanOrEqual(26)
      if (run.tone === 'shade') sawShade = true
    }
    // Đáy mây tối hơn (nắng trên-trái) và hai seed khác nhau phải ra silhouette khác.
    expect(sawShade).toBe(true)
    expect(cloudRuns(43, 72, 26)).not.toEqual(runs)
  })

  it('clamps the visual mix and hits both endpoints', () => {
    const from: WeatherVisual = { cloudCover: 0.1, rain: 0, wind: 0.2, lightning: 0 }
    const to: WeatherVisual = { cloudCover: 1, rain: 1, wind: 1.5, lightning: 2 }
    expect(mixWeatherVisual(from, to, 0)).toEqual(from)
    expect(mixWeatherVisual(from, to, 1)).toEqual(to)
    expect(mixWeatherVisual(from, to, -5)).toEqual(from)
    expect(mixWeatherVisual(from, to, 5)).toEqual(to)

    const mid = mixWeatherVisual(from, to, 0.5)
    expect(mid.rain).toBeCloseTo(0.5)
    expect(mid.lightning).toBeCloseTo(1)
  })

  it('keeps pond ripples inside the actual ponds', () => {
    let seed = 7
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    expect(WATER_AREAS.length).toBeGreaterThan(0)
    for (let i = 0; i < 200; i++) {
      const spot = pickPondSpot(rand)
      expect(spot).not.toBeNull()
      if (!spot) continue
      const inside = WATER_AREAS.some(
        (area) =>
          spot.x >= area.rect.x &&
          spot.x <= area.rect.x + area.rect.width &&
          spot.y >= area.rect.y &&
          spot.y <= area.rect.y + area.rect.height,
      )
      expect(inside).toBe(true)
    }
  })

  it('exposes a calm wind default for zones without weather coupling', () => {
    expect(CALM_WIND).toEqual({ x: 0, y: 0, strength: 0 })
  })
})
