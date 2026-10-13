import { cornerHash } from './edgeGeometry'

/**
 * Low-frequency tile variety — the fix for "checkerboard ground".
 *
 * Picking a tile variant from a per-cell random hash makes 16px tiles read as a
 * chessboard. Instead the variant comes from a smooth value-noise field, so
 * neighbouring tiles share a tone and the ground breaks into patches; per-tile
 * randomness only adds a whisper of jitter and the orientation jitter that hides
 * repeated textures. Patch edges get a speck dither of the neighbouring tone.
 *
 * Pure maths (no rendering imports) so it can be unit-tested directly.
 */

/** Patch size of the main tone field, in world px. */
export const VARIANT_PATCH_SCALE = 72
/** Patch size of the finer field that makes patch outlines irregular. */
const VARIANT_DETAIL_SCALE = 40
/** Patch size of the clutter-density field, in world px. */
export const SCATTER_DENSITY_SCALE = 64
/** How close to a variant boundary a tile starts blending, in variant units. */
const BLEND_RANGE = 0.45
/**
 * The tone field is sampled on a **rotated** lattice (~35°). Value noise varies
 * along its own grid axes, so an axis-aligned field quantised into tone bands
 * draws *rectangular* patches on screen — the "tileset is not smooth" read. A
 * rotated domain costs nothing and turns those bands into diagonal drifts.
 */
const TONE_SKEW_X = 0.82
const TONE_SKEW_Y = 0.57

export function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const gx = x / scale
  const gy = y / scale
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = smoothstep(gx - x0)
  const ty = smoothstep(gy - y0)
  const n00 = hash01(x0, y0, seed)
  const n10 = hash01(x0 + 1, y0, seed)
  const n01 = hash01(x0, y0 + 1, seed)
  const n11 = hash01(x0 + 1, y0 + 1, seed)
  const top = n00 + (n10 - n00) * tx
  const bottom = n01 + (n11 - n01) * tx
  return top + (bottom - top) * ty
}

/** `valueNoise` sampled through the rotated tone lattice (see `TONE_SKEW_*`). */
function toneNoise(x: number, y: number, scale: number, seed: number): number {
  return valueNoise(x * TONE_SKEW_X - y * TONE_SKEW_Y, x * TONE_SKEW_Y + y * TONE_SKEW_X, scale, seed)
}

/**
 * Smooth 0..1 field that decides which tone patch a tile belongs to. The detail
 * field only *perturbs* the broad one (averaging them would bunch every value
 * around 0.5 and leave the extreme tones unused), and the result is stretched so
 * the whole variant range actually shows up on a big clearing.
 */
export function variantField(x: number, y: number, seed: number): number {
  const broad = toneNoise(x, y, VARIANT_PATCH_SCALE, seed * 977 + 3)
  const detail = toneNoise(x, y, VARIANT_DETAIL_SCALE, seed * 331 + 5)
  const mixed = broad + (detail - 0.5) * 0.6
  return clamp01((mixed - 0.5) * 1.6 + 0.5)
}

/** Tile variant index for a cell: patchy, with only a whisper of per-tile jitter. */
export function groundVariant(x: number, y: number, count: number, seed: number): number {
  if (count <= 1) return 0
  const jitter = ((cornerHash(x, y, seed * 613 + 23) % 100) / 100 - 0.5) * 0.16
  const t = Math.min(0.999, Math.max(0, variantField(x, y, seed) + jitter))
  return Math.floor(t * count)
}

export interface VariantBlend {
  /** The neighbouring variant to sprinkle in. */
  variant: number
  /** 1 right at the boundary, 0 once fully inside a patch. */
  amount: number
}

/**
 * When a tile sits on the edge between two tone patches, this reports the
 * neighbouring variant so the painter can dither a few of its grains into the
 * tile — patch borders blur out instead of stepping.
 */
export function variantBoundaryBlend(x: number, y: number, count: number, seed: number): VariantBlend | null {
  if (count < 2) return null
  const scaled = variantField(x, y, seed) * count
  const index = Math.floor(scaled)
  const frac = scaled - index
  const distance = Math.min(frac, 1 - frac)
  if (distance > BLEND_RANGE) return null
  const neighbour = frac < 0.5 ? (index - 1 + count) % count : (index + 1) % count
  return { variant: neighbour, amount: 1 - distance / BLEND_RANGE }
}

/**
 * ±3% per-channel tint that follows the same low-frequency field (a whisper of
 * per-tile wobble on top), so large areas breathe without checkering.
 */
export function groundTint(x: number, y: number, seed: number): number {
  const patch = toneNoise(x, y, VARIANT_PATCH_SCALE, seed * 131 + 7)
  const micro = (cornerHash(x, y, seed * 65537 + 17) % 5) - 2
  const base = Math.round((patch - 0.5) * 14) + micro
  return (
    (clampByte(255 + base) << 16) | (clampByte(255 + Math.round(base * 0.8)) << 8) | clampByte(255 - Math.round(base * 0.4))
  )
}

/**
 * 0..1 density of ground clutter (flora on grass, debris on dirt). Low-frequency
 * so detail gathers into drifts while whole patches stay swept clean, instead of
 * an even sprinkle everywhere. Measured over the map with the default seed:
 * mean 0.45, ~22% reads swept clean (<0.18), ~12% reads dense (>0.85), and the
 * average |Δ| between neighbouring 22px cells is 0.115 (white noise ≈ 0.33).
 */
export function scatterDensity(x: number, y: number, seed: number): number {
  const broad = toneNoise(x, y, SCATTER_DENSITY_SCALE, seed * 617 + 41)
  const detail = toneNoise(x, y, SCATTER_DENSITY_SCALE / 1.6, seed * 823 + 53)
  const mixed = broad + (detail - 0.5) * 0.35
  return clamp01((mixed - 0.15) * 1.3)
}

/**
 * 0..1 field that decides what a drift holds: flowers vs tufts on grass, stones
 * vs twigs and leaves on dirt. Bigger scale than the density, so a drift keeps
 * one character.
 */
export function scatterMix(x: number, y: number, seed: number): number {
  return toneNoise(x, y, 96, seed * 461 + 29)
}

function hash01(x: number, y: number, seed: number): number {
  return cornerHash(x, y, seed) / 4294967296
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}