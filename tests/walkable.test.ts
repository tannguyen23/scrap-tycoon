import { blobContour } from '@ground/core/edgeGeometry'
import { DEFAULT_BLOB_PAD } from '@ground/core/grounds'
import { DECOR_PLACEMENTS } from '@ground/packs/scrapYard/decorPlacements'
import { SCRAP_MAP } from '@ground/packs/scrapYard/worldGrounds'
import { ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import { buildBlockers, canStand, slideMove, zoneAt } from '@ui/scene/player/walkable'
import { describe, expect, it } from 'vitest'

const blockers = buildBlockers()
const ALLEY = ZONE_LAYOUTS['alley']
if (!ALLEY) throw new Error('fixture is missing the alley layout')
const ALLEY_BOTTOM = ALLEY.rect.y + ALLEY.rect.height
const ALLEY_RIGHT = ALLEY.rect.x + ALLEY.rect.width

describe('walkable map', () => {
  it('uses the very waterline the ground pass paints', () => {
    expect(blockers.polys.length).toBe(SCRAP_MAP.water.length)
    SCRAP_MAP.water.forEach((area, index) => {
      const painted = blobContour(area.rect, area.pad ?? DEFAULT_BLOB_PAD, area.seed)
      expect(blockers.polys[index]).toEqual(painted)
    })
  })

  it('lets a walker stand on the avenue and blocks the lake', () => {
    // The avenue band is open ground (its zone declares no fence at all).
    expect(canStand(blockers, 5120, 2880)).toBe(true)
    // Middle of the west lake — and dry ground well north of its bank is fine.
    expect(canStand(blockers, 1650, 3230)).toBe(false)
    expect(canStand(blockers, 1650, 2900)).toBe(true)
  })

  it('closes the yard fences except at their gates', () => {
    // Alley: south gate is world x 4062..4134, east gate world y 2196..2244.
    expect(canStand(blockers, 4098, ALLEY_BOTTOM)).toBe(true)
    expect(canStand(blockers, 3950, ALLEY_BOTTOM)).toBe(false)
    expect(canStand(blockers, ALLEY_RIGHT, 2220)).toBe(true)
    expect(canStand(blockers, ALLEY_RIGHT, 2300)).toBe(false)
    // The unfenced avenue band never blocks.
    expect(canStand(blockers, 4512, 2880)).toBe(true)
  })

  it('treats raised clearings and solid prop bases as walls', () => {
    // Hill at 7600,2300 (elevation 2) — its edges are drawn as cliff walls.
    expect(canStand(blockers, 7690, 2360)).toBe(false)

    const solid = DECOR_PLACEMENTS.find((placement) => placement.key === 'tree0' || placement.key === 'tree1')
    const soft = DECOR_PLACEMENTS.find((placement) => placement.key === 'bush0' || placement.key === 'bush1')
    if (!solid || !soft) throw new Error('fixture is missing a tree or a bush')
    expect(canStand(blockers, solid.x, solid.y - 6)).toBe(false)
    // A bush is something you push through, not a wall.
    expect(canStand(blockers, soft.x, soft.y - 6)).toBe(true)
  })

  it('slides along a fence instead of stopping dead', () => {
    const from = { x: 3950, y: 2405 }
    // Diagonally into the south fence: sideways progress happens, straight-through
    // does not, and the walker never ends up standing inside the fence.
    const moved = slideMove(blockers, from, 2, 8)
    expect(moved.x).toBeGreaterThan(from.x)
    expect(moved.y).toBeLessThan(from.y + 8)
    expect(canStand(blockers, moved.x, moved.y)).toBe(true)
  })

  it('knows which yard the feet are in', () => {
    expect(zoneAt(4098, 2392)).toBe('alley')
    expect(zoneAt(5120, 2880)).toBe('route')
    expect(zoneAt(100, 100)).toBe(null)
  })
})
