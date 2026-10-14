import { describe, expect, it } from 'vitest'
import { createRouteVehicle } from '@ui/scene/focus/route/actors'
import { Particles } from '@ui/scene/focus/parts'

const WIDTH = 1280
const LANE = 32
const WHEELS_PER_TIER = [3, 4, 6]

describe('route vehicle actor', () => {
  it('drives inside the lane bounds, one distinct body per tier', () => {
    for (const tier of [0, 1, 2]) {
      const actor = createRouteVehicle(0, WIDTH, LANE, tier)
      const particles = new Particles()
      expect(actor.sprite.wheels.length).toBe(WHEELS_PER_TIER[tier])
      expect(actor.sprite.container.children.length).toBeGreaterThan(0)

      let minX = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let maxDrift = 0
      for (let frame = 0; frame < 60 * 30; frame++) {
        actor.update(1 / 60, particles)
        particles.update(1 / 60)
        const x = actor.sprite.container.x
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        maxDrift = Math.max(maxDrift, Math.abs(actor.sprite.container.y - LANE))
      }

      expect(Number.isFinite(minX)).toBe(true)
      expect(Number.isFinite(maxX)).toBe(true)
      expect(minX).toBeGreaterThanOrEqual(20)
      expect(maxX).toBeLessThanOrEqual(WIDTH - 52)
      expect(maxDrift).toBeLessThanOrEqual(8)
    }
  })
})
