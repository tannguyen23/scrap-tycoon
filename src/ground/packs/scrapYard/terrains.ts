import type { EdgeTones, TerrainDef, TerrainPair } from '@ground/core/terrain'
import {
  asphaltCrack,
  concreteSeams,
  fringeSpecks,
  fringeWeeds,
  grainPaint,
  grassBlades,
  plainPaint,
  SCRAP_PALETTES,
  waterPaint,
} from './tileSet'

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

/** Grass tones double as the default outer lip of every clearing. */
export const EDGE_GRASS = { base: 0x4f7d3c, light: 0x6ba24f, dark: 0x3d6730 } as const

/** Inside tones per terrain, shared with the painter's clearing decor. */
export const EDGE_TONES: Record<TileKind, EdgeTones> = {
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
  // The fringe kinds are manual leftovers of the dirt/grass look; they borrow
  // the dirt tones the old lookup fell back to.
  dirtFringe: {
    base: 0x7f6a4a,
    rim: 0x5c4a34,
    light: 0xa08a63,
    depth: 0x5c4a34,
    speckA: 0x6a5738,
    speckB: 0x95805e,
  },
  grassFringe: {
    base: EDGE_GRASS.base,
    rim: EDGE_GRASS.dark,
    light: EDGE_GRASS.light,
    depth: EDGE_GRASS.dark,
    speckA: EDGE_GRASS.dark,
    speckB: EDGE_GRASS.light,
  },
  gravelFringe: {
    base: 0x767468,
    rim: 0x565448,
    light: 0x9a988b,
    depth: 0x565448,
    speckA: 0x626053,
    speckB: 0x8d8b7e,
  },
}

/**
 * The scrap-yard terrain list. **Order is the tile generation order** — it
 * feeds the texture seeds, so reordering re-rolls the grain of every later
 * terrain (see `generateTileSet`). The `salt` values are the old per-kind hash
 * offsets, kept so the variant fields stay exactly where the map tuned them.
 */
export const SCRAP_TERRAINS: readonly TerrainDef[] = [
  {
    id: 'grass',
    ...SCRAP_PALETTES['grass']!,
    tones: EDGE_TONES.grass,
    salt: 1,
    paint: plainPaint,
    extra: grassBlades,
    surface: true,
    grassLike: true,
  },
  {
    id: 'dirt',
    ...SCRAP_PALETTES['dirt']!,
    tones: EDGE_TONES.dirt,
    salt: 2,
    paint: grainPaint(false),
    orientable: true,
    surface: true,
    dressing: true,
  },
  {
    id: 'water',
    ...SCRAP_PALETTES['water']!,
    tones: EDGE_TONES.water,
    salt: 3,
    paint: waterPaint,
    orientable: true,
    surface: true,
    aquatic: true,
  },
  {
    id: 'gravel',
    ...SCRAP_PALETTES['gravel']!,
    tones: EDGE_TONES.gravel,
    salt: 4,
    paint: grainPaint(true),
    orientable: true,
    surface: true,
    dressing: true,
  },
  {
    id: 'asphalt',
    ...SCRAP_PALETTES['asphalt']!,
    tones: EDGE_TONES.asphalt,
    salt: 5,
    paint: plainPaint,
    extra: asphaltCrack,
    orientable: true,
    surface: true,
  },
  {
    id: 'concrete',
    ...SCRAP_PALETTES['concrete']!,
    tones: EDGE_TONES.concrete,
    salt: 6,
    paint: plainPaint,
    extra: concreteSeams,
    orientable: true,
    surface: true,
  },
  {
    id: 'dirtFringe',
    ...SCRAP_PALETTES['dirtFringe']!,
    tones: EDGE_TONES.dirtFringe,
    salt: 7,
    paint: grainPaint(false),
    extra: fringeWeeds,
  },
  {
    id: 'grassFringe',
    ...SCRAP_PALETTES['grassFringe']!,
    tones: EDGE_TONES.grassFringe,
    salt: 8,
    paint: plainPaint,
    extra: (g, rnd) => {
      grassBlades(g, rnd)
      fringeSpecks(g, rnd)
    },
    grassLike: true,
  },
  {
    id: 'gravelFringe',
    ...SCRAP_PALETTES['gravelFringe']!,
    tones: EDGE_TONES.gravelFringe,
    salt: 9,
    paint: grainPaint(true),
    extra: fringeWeeds,
  },
]

export const TILE_KINDS: readonly TileKind[] = SCRAP_TERRAINS.map((terrain) => terrain.id as TileKind)

/**
 * Terrains a player-facing surface is authored in — the ones the studio's two
 * dropdowns offer. (The `*Fringe` kinds are manual leftovers, not paintable
 * surfaces.)
 */
export const PRIMARY_TERRAINS: readonly TileKind[] = SCRAP_TERRAINS.filter((terrain) => terrain.surface).map(
  (terrain) => terrain.id as TileKind,
)

/**
 * The pairs that actually occur on the map, with the reason they exist. The
 * studio can preview any combination, but this list is the contract: every entry
 * here is exercised in-game (and asserted in tests).
 */
export const TERRAIN_PAIRS: readonly TerrainPair[] = [
  { inside: 'dirt', outside: 'grass', label: 'đất ↔ cỏ (mảng đất, sàn khu)' },
  { inside: 'water', outside: 'grass', label: 'nước ↔ cỏ (bờ ao, bờ hồ)' },
  { inside: 'water', outside: 'dirt', label: 'nước ↔ đất (vũng bùn)' },
  { inside: 'gravel', outside: 'grass', label: 'sỏi ↔ cỏ (sàn khu cổng)' },
  { inside: 'gravel', outside: 'dirt', label: 'sỏi ↔ đất (bãi sỏi trong bãi đất)' },
  { inside: 'concrete', outside: 'dirt', label: 'bê tông ↔ đất (sân trước kho mòn vào đất)' },
  { inside: 'asphalt', outside: 'grass', label: 'nhựa ↔ cỏ (đại lộ xuyên map)' },
]

/** Tones of one scrap terrain (exhaustive now that tones live on the defs). */
export function terrainTones(kind: TileKind): EdgeTones {
  return EDGE_TONES[kind]
}
