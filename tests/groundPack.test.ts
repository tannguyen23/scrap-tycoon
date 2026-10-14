import { describe, expect, it } from 'vitest'
import { scatterSkipRects, validateGroundMap } from '@ground/core/grounds'
import { validateGroundPack } from '@ground/core/pack'
import { MEADOW_MAP } from '@ground/packs/meadow/map'
import { MEADOW_PACK } from '@ground/packs/meadow/pack'
import { SCRAP_YARD_PACK } from '@ground/packs/scrapYard/pack'
import { SCRAP_MAP } from '@ground/packs/scrapYard/worldGrounds'

describe('ground packs', () => {
  it('validates every shipped pack and its map', () => {
    expect(validateGroundPack(SCRAP_YARD_PACK)).toEqual([])
    expect(validateGroundPack(MEADOW_PACK)).toEqual([])
    expect(validateGroundMap(SCRAP_YARD_PACK, SCRAP_MAP)).toEqual([])
    expect(validateGroundMap(MEADOW_PACK, MEADOW_MAP)).toEqual([])
  })

  it('keeps the demo pack independent of the game art', () => {
    // The whole point of the seam: the kit renders a project by injection, so a
    // new pack shares no terrain id with the scrap yard.
    const scrapIds = new Set(SCRAP_YARD_PACK.terrains.map((terrain) => terrain.id))
    for (const terrain of MEADOW_PACK.terrains) {
      expect(scrapIds.has(terrain.id), `meadow reuses scrap terrain "${terrain.id}"`).toBe(false)
    }
    expect(MEADOW_PACK.specimens.flora.count).toBeGreaterThan(0)
    expect(MEADOW_PACK.decals.wear).not.toBe(SCRAP_YARD_PACK.decals.wear)
  })

  it('reports broken pack data instead of rendering it', () => {
    const first = MEADOW_PACK.terrains[0]
    if (!first) throw new Error('meadow pack lost its terrains')
    const broken = {
      ...MEADOW_PACK,
      terrains: [{ ...first, bases: [0x000000, 0xffffff] }],
    }
    const errors = validateGroundPack(broken)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((error) => error.includes('ramp'))).toBe(true)
  })

  it('reports map data that names a terrain the pack does not have', () => {
    const errors = validateGroundMap(MEADOW_PACK, {
      ...MEADOW_MAP,
      lanes: [{ rect: { x: 0, y: 0, width: 32, height: 32 }, kind: 'lava', seed: 1 }],
    })
    expect(errors.some((error) => error.includes('unknown terrain'))).toBe(true)
  })

  it('derives the scatter no-go rects from the map floors and extras', () => {
    const skip = scatterSkipRects(MEADOW_MAP)
    // The sand pad inflated by its pad covers a bigger area than the raw rect.
    expect(skip[0]?.x).toBe(96 - 20)
    expect(skip[0]?.width).toBe(176 + 40)
    expect(skip.length).toBe(MEADOW_MAP.floors.length + (MEADOW_MAP.scatterSkip?.length ?? 0))
  })
})
