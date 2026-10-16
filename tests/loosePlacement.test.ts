import { ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import { looseLocalPoint, looseSpots, looseWorldPoint } from '@ui/scene/loose'
import { buildBlockers, canStand, zoneAt } from '@ui/scene/player/walkable'
import { describe, expect, it } from 'vitest'

/**
 * Where debris lands. The user's rule is blunt: it appears ON THE GROUND but
 * INSIDE the yard — never outside the fence, never inside a prop — so a piece is
 * always something the player can walk to and pick up.
 */
describe('loose debris placement', () => {
  const blockers = buildBlockers()
  const rect = ZONE_LAYOUTS.alley?.rect

  it('keeps every alley spot inside the yard and on walkable ground', () => {
    expect(rect).toBeDefined()
    const spots = looseSpots('alley')
    expect(spots.length).toBeGreaterThanOrEqual(6)
    for (const spot of spots) {
      const x = (rect?.x ?? 0) + spot.x
      const y = (rect?.y ?? 0) + spot.y
      expect(zoneAt(x, y)).toBe('alley')
      expect(canStand(blockers, x, y, 3)).toBe(true)
    }
  })

  it('gives the same piece the same point every time, in the yard', () => {
    const local = looseLocalPoint('alley', 7)
    expect(looseLocalPoint('alley', 7)).toEqual(local)
    expect(looseWorldPoint('alley', 7)).toEqual({
      x: (rect?.x ?? 0) + local.x,
      y: (rect?.y ?? 0) + local.y,
    })
    // …and every id lands on a real spot inside the fence.
    for (let id = 1; id <= 24; id++) {
      const point = looseWorldPoint('alley', id)
      expect(zoneAt(point.x, point.y)).toBe('alley')
      expect(canStand(blockers, point.x, point.y, 3)).toBe(true)
    }
  })
})
