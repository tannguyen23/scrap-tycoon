import type { GroundCanvas, Point } from './groundCanvas'
import type { EdgeTones, TerrainDef, TerrainId, TerrainPair } from './terrain'

/** One scatter layer of a pack (flora on grass, debris anywhere, water drift). */
export interface SpecimenSet {
  readonly count: number
  /** Kind index for a drift: `mix` is the 0..1 drift field, `rnd` a roll. */
  pick(mix: number, rnd: () => number): number
  draw(g: GroundCanvas, x: number, y: number, kind: number, rnd: () => number): void
}

export interface TraceOptions {
  readonly seed: number
  readonly strength: number
}

/**
 * Usage traces a map can lay over the ground. The kit calls the ones it needs —
 * `puddle`/`dragMarks` from the generic ground stories, `wear`/`footprints`/
 * `ruts` from the map's own trace list.
 */
export interface GroundDecals {
  puddle(g: GroundCanvas, x: number, y: number, radiusX: number, radiusY: number, seed: number): void
  dragMarks(g: GroundCanvas, points: readonly Point[], options: TraceOptions): void
  wear(g: GroundCanvas, points: readonly Point[], options: TraceOptions): void
  footprints(g: GroundCanvas, points: readonly Point[], options: TraceOptions): void
  ruts(g: GroundCanvas, points: readonly Point[], options: TraceOptions): void
}

/** Colours the terrain fringe uses for weeds and pebbles. */
export interface FringePalette {
  readonly weed: { readonly base: number; readonly light: number }
  readonly pebble: {
    readonly base: number
    readonly base2: number
    readonly base3: number
    readonly light: number
    readonly light2: number
    readonly edge: number
    readonly shadow: number
  }
}

/** Kit defaults for the fringe palette (a temperate, grassy look). */
export const DEFAULT_FRINGE: FringePalette = {
  weed: { base: 0x4d6b33, light: 0x628a3f },
  pebble: {
    base: 0x8d8b7e,
    base2: 0x9c9a8c,
    base3: 0x8a8779,
    light: 0xb5b3a4,
    light2: 0xafad9e,
    edge: 0x5b5346,
    shadow: 0x4a4436,
  },
}

/**
 * Everything the kit needs to render one project's ground. A pack is pure data
 * plus drawers: the kit's modules never import a pack, and a pack never imports
 * another pack — that is the seam that makes the kit liftable into a new project.
 */
export interface GroundPack {
  readonly id: string
  readonly label: string
  /** Generation order matters: it feeds the tile texture seeds. */
  readonly terrains: readonly TerrainDef[]
  readonly pairs: readonly TerrainPair[]
  readonly specimens: {
    readonly flora: SpecimenSet
    readonly debris: SpecimenSet
    readonly water: SpecimenSet
  }
  readonly decals: GroundDecals
  readonly shore: (g: GroundCanvas, contour: readonly number[], seed: number) => void
  readonly fringe?: Partial<FringePalette>
}

function channelDelta(a: number, b: number): number {
  const dr = Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff))
  const dg = Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff))
  const db = Math.abs((a & 0xff) - (b & 0xff))
  return Math.max(dr, dg, db)
}

/**
 * Boot-time pack checks. The tone-ramp rule matters visually: variant indexes
 * are what the quantised tone field steps through, so two neighbours in the
 * list end up side by side on the map and any step larger than ~10/255 reads as
 * a blocky seam along the band edge.
 */
export function validateGroundPack(pack: GroundPack): string[] {
  const errors: string[] = []
  if (!pack.id) errors.push('pack id must not be empty')
  if (pack.terrains.length === 0) errors.push(`ground pack "${pack.id}" has no terrains`)

  const seen = new Set<TerrainId>()
  let surfaces = 0
  for (const def of pack.terrains) {
    if (seen.has(def.id)) errors.push(`duplicate terrain id "${def.id}"`)
    seen.add(def.id)
    if (def.bases.length === 0) errors.push(`terrain "${def.id}" has no base tones`)
    if (def.specks.length === 0) errors.push(`terrain "${def.id}" has no speck pairs`)
    if (!Number.isInteger(def.salt)) errors.push(`terrain "${def.id}" salt must be an integer`)
    for (let i = 0; i + 1 < def.bases.length; i++) {
      const step = channelDelta(def.bases[i] ?? 0, def.bases[i + 1] ?? 0)
      if (step > 10) {
        errors.push(`terrain "${def.id}" variant ${i} -> ${i + 1} steps ${step}/255 (keep the list a brightness ramp)`)
      }
    }
    if (def.surface) surfaces++
  }
  if (surfaces === 0) errors.push(`ground pack "${pack.id}" offers no surface terrain`)

  for (const pair of pack.pairs) {
    if (!seen.has(pair.inside)) errors.push(`pair "${pair.label}" names unknown inside terrain "${pair.inside}"`)
    if (!seen.has(pair.outside)) errors.push(`pair "${pair.label}" names unknown outside terrain "${pair.outside}"`)
    if (pair.inside === pair.outside) {
      errors.push(`pair "${pair.label}" transitions a terrain into itself (skip edges instead)`)
    }
  }
  return errors
}

/** Tone lookup a map/fringe caller can use without knowing the pack layout. */
export function tonesOf(pack: GroundPack, kind: TerrainId): EdgeTones | undefined {
  return pack.terrains.find((terrain) => terrain.id === kind)?.tones
}
