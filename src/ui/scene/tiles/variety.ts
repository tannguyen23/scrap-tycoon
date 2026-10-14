import { cornerHash } from './edgeGeometry'
import { TILE_SIZE } from './terrain'

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

/**
 * Patch size of the *base* tone octave, in world px.
 *
 * Sized against the tile: one tone patch has to cover *several* tiles or the
 * quantised field steps on nearly every neighbour and the ground reads as a
 * chessboard. Measured: at 72px the mean run of one tone was 1.7 tiles (58% of
 * neighbours differed) — a quilt, not patches.
 */
export const VARIANT_PATCH_SCALE = 560
/**
 * Octave stack for the tone field.
 *
 * More octaves is *not* decoration here, it is what makes the patches the right
 * shape. One octave of value noise is a bilinear ramp inside each lattice cell,
 * so its level sets are straight lines; at a patch scale this large a clearing
 * sits almost entirely inside one cell and the "patches" came out as endlessly
 * straight bands, which the tile grid then quantised into rectangles (dumped the
 * grid: whole columns shared one variant — a pure 1-D ramp). Stacking octaves
 * makes the contour wander at every scale, so a band edge is never straight.
 */
const TONE_OCTAVES = 3
const TONE_OCTAVE_FALLOFF = 0.3
const TONE_OCTAVE_LACUNARITY = 2
/**
 * Gain applied about the middle. Value noise bunches around 0.5, so without it the
 * extreme tones never appear; too much of it and the field clips for long stretches.
 */
const FIELD_GAIN = 2.2
/** Patch size of the clutter-density field, in world px. */
export const SCATTER_DENSITY_SCALE = 64
/**
 * How close to a variant boundary a tile starts blending, in variant units. Kept
 * tight on purpose: a band is only a few tiles wide, so a wide range puts *most of
 * the map* in the dither pass and spends hundreds of thousands of rects on tiles
 * that sit nowhere near a seam. This keeps the dither to roughly the border tile.
 */
const BLEND_RANGE = 0.25
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
 * Fractal sum of the tone noise. Each octave gets its own seed so they do not
 * correlate, and the stack is normalised by the total amplitude so the result
 * stays in 0..1 whatever `TONE_OCTAVES` is.
 */
function fbmTone(x: number, y: number, seed: number): number {
  let value = 0
  let total = 0
  let amplitude = 1
  let scale = VARIANT_PATCH_SCALE
  for (let octave = 0; octave < TONE_OCTAVES; octave++) {
    value += toneNoise(x, y, scale, seed * 977 + 3 + octave * 131) * amplitude
    total += amplitude
    amplitude *= TONE_OCTAVE_FALLOFF
    scale /= TONE_OCTAVE_LACUNARITY
  }
  return value / total
}

/**
 * Smooth 0..1 field that decides which tone patch a tile belongs to.
 *
 * Sampled from `fbmTone` (see the octave note above — one octave alone draws
 * straight bands) and then stretched so the whole variant range shows up on a big
 * clearing. The stretch is deliberately **linear**: this field is *quantised* into
 * tone bands, so any curve here spends its steepness on some part of the range and
 * steepness is band width — a soft roll-off made the middle bands so narrow that
 * consecutive tiles alternated (measured: mean run 2.0 tiles). Linear keeps every
 * band the same width, and the clipped ends are invisible: tiles either side of a
 * clip both fall in the same end band, so no edge is drawn.
 */
export function variantField(x: number, y: number, seed: number): number {
  return clamp01((fbmTone(x, y, seed) - 0.5) * FIELD_GAIN + 0.5)
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
 * Weight for one dither speck at `(px, py)` inside the tile at `(x, y)`.
 *
 * 1 sits on a tile edge whose neighbour holds a different tone and falls to 0
 * away from it, so the blend creeps over the seam like a gradient. Sprinkling
 * the whole tile evenly instead turned every boundary tile into a speckled
 * *block* — measured along the alley lane: runs of up to 9 speckled tiles in a
 * row, which reads as rectangles on a narrow band, not a transition.
 *
 * Returns 0 when no 4-neighbour differs, which makes the caller's "is there a
 * seam at all" check implicit.
 */
export function boundaryDitherWeight(
  x: number,
  y: number,
  px: number,
  py: number,
  count: number,
  seed: number,
): number {
  if (count < 2) return 0
  const own = groundVariant(x, y, count, seed)
  const u = clamp01((px - x) / TILE_SIZE)
  const v = clamp01((py - y) / TILE_SIZE)
  let weight = 0
  if (groundVariant(x - TILE_SIZE, y, count, seed) !== own) weight = Math.max(weight, 1 - u)
  if (groundVariant(x + TILE_SIZE, y, count, seed) !== own) weight = Math.max(weight, u)
  if (groundVariant(x, y - TILE_SIZE, count, seed) !== own) weight = Math.max(weight, 1 - v)
  if (groundVariant(x, y + TILE_SIZE, count, seed) !== own) weight = Math.max(weight, v)
  return weight
}

/**
 * ±3% per-channel tint that follows the same low-frequency field (a whisper of
 * per-tile wobble on top), so large areas breathe without checkering.
 *
 * Uses the same octave stack as the tone bands, and for the same reason: a single
 * octave of value noise ramps straight across a lattice cell, and because the tint
 * is rounded to whole levels its level sets show up as faint *straight* steps
 * running through the middle of a clearing.
 */
export function groundTint(x: number, y: number, seed: number): number {
  const patch = fbmTone(x, y, seed * 131 + 7)
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