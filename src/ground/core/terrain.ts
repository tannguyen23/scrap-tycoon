import type { Graphics } from 'pixi.js'

/** Terrain ids are pack data — the kit never hardcodes one. */
export type TerrainId = string

/** Per-terrain palette used by the transition tiles, walls and fringe. */
export interface EdgeTones {
  base: number
  rim: number
  light: number
  depth: number
  speckA: number
  speckB: number
}

/** One previewable transition pair (drives the studio dropdowns). */
export interface TerrainPair {
  inside: TerrainId
  outside: TerrainId
  label: string
}

/** What a terrain's tile painter receives. */
export interface TilePaintContext {
  readonly g: Graphics
  readonly rnd: () => number
  readonly variant: number
  readonly base: number
  readonly speckA: number
  readonly speckB: number
}

export type TilePaintFn = (ctx: TilePaintContext) => void

/**
 * One terrain of a pack: its tone variants plus everything the kit needs to
 * build tiles, transitions and dressing for it. The array order is the
 * generation order — it feeds the texture seeds, so reordering changes art.
 */
export interface TerrainDef {
  readonly id: TerrainId
  /** One base tone per variant — also the variant count. */
  readonly bases: readonly number[]
  /** Speck pairs, indexed by `variant % length`. */
  readonly specks: readonly (readonly [number, number])[]
  readonly tones: EdgeTones
  /** Hash offset so two terrains never share a variant field. */
  readonly salt: number
  readonly paint: TilePaintFn
  /** Per-tile extras drawn after the base fill (grass blades, slab seams…). */
  readonly extra?: (g: Graphics, rnd: () => number) => void
  /** Isotropic texture: the painter rotates/flips cells to hide repetition. */
  readonly orientable?: boolean
  /** Offered as a paintable surface in the studio dropdowns. */
  readonly surface?: boolean
  /** Reads as vegetation: transitions paint blades instead of pebbles. */
  readonly grassLike?: boolean
  /** Water-like: the painter adds the shore pass and the water drift scatter. */
  readonly aquatic?: boolean
  /** Loose ground: the painter adds pebble clusters, edge litter and stories. */
  readonly dressing?: boolean
}

/** Fast id → def lookup for a pack's terrain list. */
export function terrainMap(terrains: readonly TerrainDef[]): Map<TerrainId, TerrainDef> {
  const map = new Map<TerrainId, TerrainDef>()
  for (const terrain of terrains) map.set(terrain.id, terrain)
  return map
}
