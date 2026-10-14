import { describe, expect, it } from 'vitest'
import {
  groundTint,
  groundVariant,
  scatterDensity,
  scatterMix,
  variantBoundaryBlend,
  variantField,
} from '@ui/scene/tiles/variety'

const COUNT = 8
const SEED = 7

/** Fraction of adjacent tiles that share a variant (white noise would give 1/count). */
function neighbourAgreement(step: number): number {
  let same = 0
  let total = 0
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const a = groundVariant(x * 16, y * 16, COUNT, SEED)
      const right = groundVariant((x + step) * 16, y * 16, COUNT, SEED)
      const down = groundVariant(x * 16, (y + step) * 16, COUNT, SEED)
      if (a === right) same++
      if (a === down) same++
      total += 2
    }
  }
  return same / total
}

/** Average number of consecutive tiles that hold one tone. */
function meanRunLength(): number {
  const runs: number[] = []
  let run = 1
  for (let x = 1; x < 512; x++) {
    const previous = groundVariant((x - 1) * 16, 128, COUNT, SEED)
    if (groundVariant(x * 16, 128, COUNT, SEED) === previous) run++
    else {
      runs.push(run)
      run = 1
    }
  }
  runs.push(run)
  return runs.reduce((a, b) => a + b, 0) / runs.length
}

function channelDelta(a: number, b: number): number {
  const dr = Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff))
  const dg = Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff))
  const db = Math.abs((a & 0xff) - (b & 0xff))
  return Math.max(dr, dg, db)
}

describe('low-frequency tile variety', () => {
  it('clusters variants into patches instead of checkering', () => {
    // The bar is a *visual* one, not "better than white noise": each tone step is a
    // whole palette step, so neighbours changing tone on most tiles draws a quilt.
    // Measured before this was enforced: agreement 0.35 (mean run 1.5 tiles) — the
    // old assertion (0.125 * 2.5 = 0.31) passed a ground that was visibly checkered.
    // Now ~0.79, and grass over the map sits at ~0.74 with ~3.6-tile runs.
    expect(neighbourAgreement(1)).toBeGreaterThan(0.65)
    expect(meanRunLength()).toBeGreaterThan(3)
  })

  it('still uses every variant across a wide area', () => {
    const seen = new Set<number>()
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 60; x++) {
        seen.add(groundVariant(x * 16, y * 16, COUNT, SEED))
      }
    }
    expect(seen.size).toBe(COUNT)
  })

  it('is deterministic', () => {
    expect(groundVariant(48, 96, COUNT, SEED)).toBe(groundVariant(48, 96, COUNT, SEED))
    expect(groundTint(48, 96, SEED)).toBe(groundTint(48, 96, SEED))
    expect(variantBoundaryBlend(48, 96, COUNT, SEED)?.variant).toBe(
      variantBoundaryBlend(48, 96, COUNT, SEED)?.variant,
    )
  })

  it('keeps the tint of neighbouring tiles close (no per-cell flicker)', () => {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const a = groundTint(x * 16, y * 16, SEED)
        expect(channelDelta(a, groundTint(x * 16 + 16, y * 16, SEED))).toBeLessThanOrEqual(20)
        expect(channelDelta(a, groundTint(x * 16, y * 16 + 16, SEED))).toBeLessThanOrEqual(20)
      }
    }
  })

  it('blends only near a variant boundary', () => {
    let blends = 0
    let clean = 0
    for (let x = 0; x < 80; x++) {
      const blend = variantBoundaryBlend(x * 16, 40, COUNT, SEED)
      if (!blend) {
        clean++
        continue
      }
      expect(blend.amount).toBeGreaterThan(0)
      expect(blend.amount).toBeLessThanOrEqual(1)
      expect(blend.variant).toBeGreaterThanOrEqual(0)
      expect(blend.variant).toBeLessThan(COUNT)
      blends++
    }
    expect(blends).toBeGreaterThan(0)
    expect(clean).toBeGreaterThan(0)
  })

  it('keeps the field inside 0..1', () => {
    for (let i = 0; i < 200; i++) {
      const value = variantField(i * 13, i * 7, SEED)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe('scatter density field', () => {
  const FIELD_SEED = 41

  it('spans clean to dense across the map', () => {
    let min = 1
    let max = 0
    let clean = 0
    let dense = 0
    let samples = 0
    for (let y = 0; y < 540; y += 12) {
      for (let x = 0; x < 960; x += 12) {
        const density = scatterDensity(x, y, FIELD_SEED)
        expect(density).toBeGreaterThanOrEqual(0)
        expect(density).toBeLessThanOrEqual(1)
        min = Math.min(min, density)
        max = Math.max(max, density)
        if (density < 0.18) clean++
        if (density > 0.85) dense++
        samples++
      }
    }
    expect(min).toBeLessThan(0.05)
    expect(max).toBeGreaterThan(0.9)
    // Real swept-clean patches and real drifts, without either taking over.
    expect(clean / samples).toBeGreaterThan(0.1)
    expect(clean / samples).toBeLessThan(0.4)
    expect(dense / samples).toBeGreaterThan(0.05)
    expect(dense / samples).toBeLessThan(0.3)
  })

  it('is low-frequency, so details gather instead of sprinkling evenly', () => {
    let total = 0
    let count = 0
    const step = 22 // the scatter cell size the game actually samples at
    for (let y = 0; y < 300; y += step) {
      for (let x = 0; x < 600; x += step) {
        total += Math.abs(scatterDensity(x, y, FIELD_SEED) - scatterDensity(x + step, y, FIELD_SEED))
        count++
      }
    }
    // White noise averages ~0.33 between any two cells; the field measures 0.115.
    expect(total / count).toBeLessThan(0.15)
  })

  it('keeps the drift mix inside 0..1', () => {
    for (let i = 0; i < 200; i++) {
      const mix = scatterMix(i * 17, i * 11, FIELD_SEED)
      expect(mix).toBeGreaterThanOrEqual(0)
      expect(mix).toBeLessThanOrEqual(1)
    }
  })
})