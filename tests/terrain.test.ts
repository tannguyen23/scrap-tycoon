import { describe, expect, it } from 'vitest'
import {
  EDGE_TONES,
  PRIMARY_TERRAINS,
  TERRAIN_PAIRS,
  TILE_KINDS,
  terrainTones,
} from '@ui/scene/tiles/terrain'

describe('terrain tables', () => {
  it('gives every previewable terrain its own tone entry', () => {
    for (const kind of PRIMARY_TERRAINS) {
      expect(EDGE_TONES[kind], kind).toBeDefined()
      expect(TILE_KINDS, kind).toContain(kind)
    }
    expect(PRIMARY_TERRAINS.length).toBeGreaterThanOrEqual(6)
  })

  it('falls back safely for terrains without a tone entry', () => {
    const fallback = terrainTones('grassFringe')
    expect(fallback.base).toBeGreaterThan(0)
    expect(fallback.light).toBeGreaterThan(0)
  })

  it('takes the lip tones from the outside terrain', () => {
    const grass = terrainTones('grass')
    const dirt = terrainTones('dirt')
    expect(grass.base).not.toBe(dirt.base)
    expect(dirt.light).toBe(0xa08a63)
    expect(terrainTones('water').base).not.toBe(dirt.base)
  })
})

describe('terrain transition pairs', () => {
  it('lists labelled, unique pairs built from previewable terrains', () => {
    expect(TERRAIN_PAIRS.length).toBeGreaterThanOrEqual(6)
    const seen = new Set<string>()
    for (const pair of TERRAIN_PAIRS) {
      expect(pair.label.length, `${pair.inside}/${pair.outside}`).toBeGreaterThan(2)
      expect(PRIMARY_TERRAINS, pair.label).toContain(pair.inside)
      expect(PRIMARY_TERRAINS, pair.label).toContain(pair.outside)
      seen.add(`${pair.inside}|${pair.outside}`)
    }
    expect(seen.size).toBe(TERRAIN_PAIRS.length)
  })

  it('covers the pairs the map actually uses', () => {
    const has = (inside: string, outside: string): boolean =>
      TERRAIN_PAIRS.some((pair) => pair.inside === inside && pair.outside === outside)
    // zone floors / clearings in grass, pit floors inside their own terrain,
    // ponds in grass and in dirt, and the gravel heap dug into a dirt clearing.
    expect(has('dirt', 'grass')).toBe(true)
    expect(has('water', 'grass')).toBe(true)
    expect(has('water', 'dirt')).toBe(true)
    expect(has('gravel', 'grass')).toBe(true)
    expect(has('gravel', 'dirt')).toBe(true)
    // worn concrete apron fading into the depot's dirt
    expect(has('concrete', 'dirt')).toBe(true)
    // A floor of the same terrain as its surroundings is NOT a pair: transition
    // tiles there would draw a lip + occlusion ring between two stretches of one
    // material, which reads as a pasted-on floor (see `paintTiles`).
    expect(has('dirt', 'dirt')).toBe(false)
    expect(has('gravel', 'gravel')).toBe(false)
  })
})