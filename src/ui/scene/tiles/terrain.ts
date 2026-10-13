/**
 * Terrain identities and tone tables — pure data (no rendering imports), shared
 * by the tile generator, the edge-tile generator, the painter and the studio.
 */

export type TileKind =
  | 'grass'
  | 'dirt'
  | 'water'
  | 'gravel'
  | 'asphalt'
  | 'concrete'
  | 'dirtFringe'
  | 'grassFringe'
  | 'gravelFringe'

export const TILE_SIZE = 16

export const TILE_KINDS: readonly TileKind[] = [
  'grass',
  'dirt',
  'water',
  'gravel',
  'asphalt',
  'concrete',
  'dirtFringe',
  'grassFringe',
  'gravelFringe',
]

export interface EdgeTones {
  base: number
  /** Band just inside the contour (wet mud at a waterline, packed dirt at a clearing). */
  rim: number
  /** Highlight tone, also used by the interior tonal patches. */
  light: number
  /** Darker tone for the interior tonal patches (depth in water, damp dirt). */
  depth: number
  speckA: number
  speckB: number
}

/** Grass tones double as the default outer lip of every clearing. */
export const EDGE_GRASS = { base: 0x4f7d3c, light: 0x6ba24f, dark: 0x3d6730 } as const

/** Inside tones per terrain, shared with the painter's clearing decor. */
export const EDGE_TONES: Partial<Record<TileKind, EdgeTones>> = {
  grass: {
    base: EDGE_GRASS.base,
    rim: EDGE_GRASS.dark,
    light: EDGE_GRASS.light,
    depth: EDGE_GRASS.dark,
    speckA: EDGE_GRASS.dark,
    speckB: EDGE_GRASS.light,
  },
  dirt: {
    base: 0x7f6a4a,
    rim: 0x5c4a34,
    light: 0xa08a63,
    depth: 0x5c4a34,
    speckA: 0x6a5738,
    speckB: 0x95805e,
  },
  gravel: {
    base: 0x767468,
    rim: 0x565448,
    light: 0x9a988b,
    depth: 0x565448,
    speckA: 0x626053,
    speckB: 0x8d8b7e,
  },
  asphalt: {
    base: 0x5b6472,
    rim: 0x474e59,
    light: 0x7c8898,
    depth: 0x474e59,
    speckA: 0x4d5563,
    speckB: 0x707a88,
  },
  concrete: {
    base: 0x9a968c,
    rim: 0x8b877c,
    light: 0xbcb8ae,
    depth: 0x8b877c,
    speckA: 0x8b877c,
    speckB: 0xa8a49a,
  },
  water: {
    base: 0x46759a,
    rim: 0x7a6a4a,
    light: 0x7fc0d8,
    depth: 0x2a5070,
    speckA: 0x35607d,
    speckB: 0x9fd4e8,
  },
}

/** Tones of the terrain a clearing sits in — drives its lip and fringe. */
export function terrainTones(kind: TileKind): EdgeTones {
  return EDGE_TONES[kind] ?? EDGE_TONES.dirt ?? { base: 0x7f6a4a, rim: 0x5c4a34, light: 0xa08a63, depth: 0x5c4a34, speckA: 0x6a5738, speckB: 0x95805e }
}

export interface TerrainPair {
  inside: TileKind
  outside: TileKind
  /** Human label for the studio switcher. */
  label: string
}

/**
 * Terrains a player-facing surface is authored in — the ones the studio's two
 * dropdowns offer. (The `*Fringe` kinds are manual leftovers, not paintable
 * surfaces.)
 */
export const PRIMARY_TERRAINS: readonly TileKind[] = ['grass', 'dirt', 'water', 'gravel', 'asphalt', 'concrete']

/**
 * The pairs that actually occur on the map, with the reason they exist. The
 * studio can preview any combination, but this list is the contract: every entry
 * here is exercised in-game (and asserted in tests).
 */
export const TERRAIN_PAIRS: readonly TerrainPair[] = [
  { inside: 'dirt', outside: 'grass', label: 'đất ↔ cỏ (mảng đất, sàn khu)' },
  { inside: 'water', outside: 'grass', label: 'nước ↔ cỏ (bờ ao)' },
  { inside: 'water', outside: 'dirt', label: 'nước ↔ đất (vũng bùn)' },
  { inside: 'gravel', outside: 'grass', label: 'sỏi ↔ cỏ (sàn khu cổng)' },
  { inside: 'gravel', outside: 'dirt', label: 'sỏi ↔ đất (bãi sỏi trong bãi đất)' },
  { inside: 'concrete', outside: 'dirt', label: 'bê tông ↔ đất (sân trước kho mòn vào đất)' },
]