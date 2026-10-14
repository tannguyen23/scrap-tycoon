import type { GroundCanvas, Point } from '@ground/core/groundCanvas'
import type { GroundDecals, GroundPack, SpecimenSet } from '@ground/core/pack'
import type { EdgeTones, TerrainDef, TilePaintFn } from '@ground/core/terrain'

/**
 * Meadow — the demo pack. A warm, arid meadow (lawns, a dusty trail, dry sand,
 * a pond) that shares **no art** with the scrap yard: every terrain, specimen,
 * decal and shore line below is written here, against the kit's contract only.
 * It exists to prove the kit renders a project by injection; if this pack ever
 * needs a scrap-yard module, the seam is wrong.
 */

const TONES: Record<string, EdgeTones> = {
  lawn: { base: 0x6aa84f, rim: 0x4d7a3a, light: 0x9ccb6b, depth: 0x3f6b2f, speckA: 0x5a9642, speckB: 0xa8d47a },
  trail: { base: 0xa98a5f, rim: 0x7d6743, light: 0xd0b183, depth: 0x6b5738, speckA: 0x8d7350, speckB: 0xc7a878 },
  sand: { base: 0xd8c08a, rim: 0xb39b68, light: 0xf0dcb0, depth: 0x9a8659, speckA: 0xc4a976, speckB: 0xeedcae },
  pond: { base: 0x3f8fa8, rim: 0x2c6a80, light: 0x8fd4e2, depth: 0x1f5063, speckA: 0x337a92, speckB: 0xa9e2ec },
}

const lawnPaint: TilePaintFn = (ctx) => {
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(ctx.rnd() * 15)
    const y = Math.floor(ctx.rnd() * 15)
    ctx.g.rect(x, y, 1, 1).fill({ color: ctx.rnd() < 0.5 ? ctx.speckA : ctx.speckB, alpha: 0.8 })
  }
  if (ctx.rnd() < 0.4) {
    const x = Math.floor(ctx.rnd() * 14)
    const y = 2 + Math.floor(ctx.rnd() * 12)
    ctx.g.rect(x, y, 1, 3).fill({ color: ctx.speckA, alpha: 0.9 })
  }
}

const trailPaint: TilePaintFn = (ctx) => {
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(ctx.rnd() * 14)
    const y = Math.floor(ctx.rnd() * 15)
    ctx.g.rect(x, y, 2, 1).fill({ color: ctx.speckA, alpha: 0.75 })
  }
  if (ctx.rnd() < 0.35) {
    const x = Math.floor(ctx.rnd() * 13)
    const y = Math.floor(ctx.rnd() * 14)
    ctx.g.rect(x, y, 2, 2).fill({ color: ctx.speckB, alpha: 0.5 })
  }
}

const sandPaint: TilePaintFn = (ctx) => {
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(ctx.rnd() * 15)
    const y = Math.floor(ctx.rnd() * 15)
    ctx.g.rect(x, y, 1, 1).fill({ color: ctx.rnd() < 0.6 ? ctx.speckA : ctx.speckB, alpha: 0.7 })
  }
  if (ctx.rnd() < 0.5) {
    const y = Math.floor(ctx.rnd() * 14)
    ctx.g.rect(0, y, 16, 1).fill({ color: ctx.speckA, alpha: 0.25 })
  }
}

const pondPaint: TilePaintFn = (ctx) => {
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(ctx.rnd() * 11)
    const y = Math.floor(ctx.rnd() * 16)
    ctx.g.rect(x, y, 3, 1).fill({ color: ctx.speckB, alpha: 0.35 })
  }
  if (ctx.rnd() < 0.4) ctx.g.rect(Math.floor(ctx.rnd() * 16), Math.floor(ctx.rnd() * 16), 1, 1).fill({ color: ctx.speckA, alpha: 0.7 })
}

export const MEADOW_TERRAINS: readonly TerrainDef[] = [
  { id: 'lawn', ...palette([0x5f9c46, 0x64a34a, 0x69a94e, 0x6eb052], 'lawn'), tones: TONES['lawn']!, salt: 1, paint: lawnPaint, surface: true, grassLike: true },
  { id: 'trail', ...palette([0x9f8158, 0xa4875d, 0xa98d62, 0xaf936a], 'trail'), tones: TONES['trail']!, salt: 2, paint: trailPaint, orientable: true, surface: true, dressing: true },
  { id: 'sand', ...palette([0xcaae74, 0xd0b47c, 0xd4ba80, 0xd8c08a], 'sand'), tones: TONES['sand']!, salt: 3, paint: sandPaint, orientable: true, surface: true, dressing: true },
  { id: 'pond', ...palette([0x377f96, 0x3b869d, 0x3d8ba2, 0x3f8fa8], 'pond'), tones: TONES['pond']!, salt: 4, paint: pondPaint, orientable: true, surface: true, aquatic: true },
]

/** A brightness-ramp palette whose grain pair is the terrain's own specks. */
function palette(
  bases: readonly number[],
  tone: string,
): { bases: readonly number[]; specks: readonly (readonly [number, number])[] } {
  const tones = TONES[tone]
  return { bases, specks: tones ? [[tones.speckA, tones.speckB]] : [[0x808080, 0xa0a0a0]] }
}

function dot(g: GroundCanvas, x: number, y: number, color: number, alpha = 0.9): void {
  g.rect(Math.round(x), Math.round(y), 1, 1).fill({ color, alpha })
}

const flora: SpecimenSet = {
  count: 3,
  pick: (mix, rnd) => (mix > 0.66 ? 0 : mix > 0.33 ? 1 : Math.floor(rnd() * 2)),
  draw: (g, x, y, kind, rnd) => {
    if (kind === 0) {
      g.rect(Math.round(x), Math.round(y) - 3, 1, 3).fill({ color: 0x4d7a3a, alpha: 0.9 })
      g.rect(Math.round(x) - 1, Math.round(y) - 4, 3, 1).fill({ color: 0xf5f0d0, alpha: 0.95 })
    } else if (kind === 1) {
      for (let i = 0; i < 3; i++) dot(g, x + i - 1, y - 1 - i, 0x83c25c, 0.85)
    } else {
      dot(g, x, y - 2, 0xd9683f, 0.95)
      dot(g, x, y - 1, 0x4d7a3a, 0.8)
    }
    if (rnd() < 0.2) dot(g, x + 2, y, 0x9ccb6b, 0.6)
  },
}

const debris: SpecimenSet = {
  count: 3,
  pick: (_mix, rnd) => Math.floor(rnd() * 3),
  draw: (g, x, y, kind, rnd) => {
    if (kind === 0) {
      g.rect(Math.round(x), Math.round(y), 1.5, 1).fill({ color: 0xb9a077, alpha: 0.9 })
      dot(g, x + 1, y - 1, 0xd8c08a, 0.8)
    } else if (kind === 1) {
      g.rect(Math.round(x), Math.round(y), 3, 0.75).fill({ color: 0x8d7350, alpha: 0.85 })
    } else {
      dot(g, x, y, 0xe8dcc0, 0.9)
      dot(g, x + 1, y, 0xc4a976, 0.7)
    }
    if (rnd() < 0.3) dot(g, x - 1, y + 1, 0x9a8659, 0.5)
  },
}

const water: SpecimenSet = {
  count: 3,
  pick: (_mix, rnd) => Math.floor(rnd() * 3),
  draw: (g, x, y, kind) => {
    if (kind === 0) {
      g.rect(Math.round(x), Math.round(y), 2, 0.75).fill({ color: 0xa9e2ec, alpha: 0.5 })
    } else if (kind === 1) {
      g.ellipse(Math.round(x), Math.round(y), 2, 1).fill({ color: 0x5aa86a, alpha: 0.85 })
      dot(g, x, y, 0x3f8f52, 0.6)
    } else {
      dot(g, x, y, 0xd8c08a, 0.8)
      dot(g, x + 1, y, 0x8d7350, 0.7)
    }
  },
}

function trace(g: GroundCanvas, points: readonly Point[], seed: number, strength: number, kind: 'wear' | 'footprints' | 'ruts'): void {
  const step = 3
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (!a || !b) continue
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const parts = Math.max(1, Math.round(length / step))
    for (let s = 0; s <= parts; s++) {
      const t = s / parts
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      const jitter = (((seed + s * 37) % 5) - 2) * 0.6
      if (kind === 'wear') {
        g.rect(Math.round(x), Math.round(y + jitter), 2, 1).fill({ color: 0x8d7350, alpha: 0.3 * strength })
      } else if (kind === 'footprints') {
        if (s % 2 === 0) dot(g, x + jitter, y, 0x7d6743, 0.4 * strength)
      } else {
        g.rect(Math.round(x), Math.round(y - 4 + jitter), 1, 1).fill({ color: 0x7d6743, alpha: 0.35 * strength })
        g.rect(Math.round(x), Math.round(y + 4 + jitter), 1, 1).fill({ color: 0x7d6743, alpha: 0.35 * strength })
      }
    }
  }
}

const decals: GroundDecals = {
  puddle: (g, x, y, rx, ry) => {
    g.ellipse(Math.round(x), Math.round(y), rx, ry).fill({ color: 0x3f8fa8, alpha: 0.45 })
    g.ellipse(Math.round(x), Math.round(y), rx - 1, ry - 1).fill({ color: 0x6fb6c9, alpha: 0.5 })
  },
  dragMarks: (g, points, options) => trace(g, points, options.seed, options.strength, 'wear'),
  wear: (g, points, options) => trace(g, points, options.seed, options.strength, 'wear'),
  footprints: (g, points, options) => trace(g, points, options.seed, options.strength, 'footprints'),
  ruts: (g, points, options) => trace(g, points, options.seed, options.strength, 'ruts'),
}

/** Foam dashes along the waterline — this pack's own shore language. */
function meadowShore(g: GroundCanvas, contour: readonly number[], seed: number): void {
  for (let i = 0; i < contour.length / 2; i += 2) {
    const x = contour[i] ?? 0
    const y = contour[i + 1] ?? 0
    if ((i + seed) % 8 === 0) g.rect(Math.round(x), Math.round(y), 2, 0.75).fill({ color: 0xe8f6f8, alpha: 0.45 })
    if ((i + seed) % 14 === 0) dot(g, x - 1, y + 1, 0xb9a077, 0.7)
  }
}

export const MEADOW_PACK: GroundPack = {
  id: 'meadow',
  label: 'Meadow (demo)',
  terrains: MEADOW_TERRAINS,
  pairs: [
    { inside: 'sand', outside: 'lawn', label: 'cát ↔ cỏ (bãi cát)' },
    { inside: 'pond', outside: 'lawn', label: 'nước ↔ cỏ (ao)' },
    { inside: 'trail', outside: 'lawn', label: 'lối mòn ↔ cỏ' },
    { inside: 'sand', outside: 'trail', label: 'cát ↔ lối mòn (bãi đỗ)' },
  ],
  specimens: { flora, debris, water },
  decals,
  shore: meadowShore,
  fringe: {
    weed: { base: 0x6f8f4a, light: 0x8fae63 },
    pebble: {
      base: 0xb9a077,
      base2: 0xc9b189,
      base3: 0xa8916a,
      light: 0xe4d3ad,
      light2: 0xd6c39a,
      edge: 0x7d6743,
      shadow: 0x5f4e33,
    },
  },
}
