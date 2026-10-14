import type { Graphics } from 'pixi.js'
import type { TilePaintContext, TilePaintFn } from '@ground/core/terrain'

/**
 * Scrap-yard tile palettes: base tones + speck pairs per variant. Dirt carries
 * the most variants on purpose: large clearings are where repetition shows, so
 * it mixes hue-shifted tones instead of one brown.
 *
 * **The array order is a brightness ramp**: the tone field quantises into bands
 * that follow the index, so two neighbours in this list end up next to each
 * other on screen. Any step larger than ~10/255 reads as a blocky seam along
 * the band edge (`validateGroundPack` enforces the bound). Hues still vary — the
 * ramp sorts them by brightness instead of scattering them. Keep each variant's
 * speck pair riding with its base when reordering.
 */
export const SCRAP_PALETTES: Record<
  string,
  { bases: readonly number[]; specks: readonly (readonly [number, number])[] }
> = {
  grass: {
    // Sáu tông chênh nhau rất ít (≤ 5/255 mỗi bước): mảng tông trên cỏ đọc ra là
    // "cỏ sáng/tối" chứ không thành các ô vuông khác màu.
    bases: [0x497536, 0x4b7839, 0x4d7b3b, 0x4f7d3c, 0x53823f, 0x568642],
    specks: [[0x3d6730, 0x6ba24f]],
  },
  dirt: {
    bases: [0x746349, 0x77684b, 0x7c6b4c, 0x7d694a, 0x7f6a4a, 0x817052, 0x83704f, 0x866b52],
    specks: [
      [0x5c5245, 0x8c8474],
      [0x63513a, 0x9a8460],
      [0x665341, 0x8f7b58],
      [0x6a5540, 0x93795a],
      [0x6a5738, 0x95805e],
      [0x6f6242, 0xa39a74],
      [0x715c3d, 0xa08a63],
      [0x7a5240, 0xa8795c],
    ],
  },
  water: {
    // Nước ao bãi phế liệu: xanh lục lam, hơi đục. Sáu tông xếp theo ramp sáng.
    bases: [0x43789a, 0x457a9c, 0x477d9f, 0x4a80a2, 0x4b81a3, 0x4e85a6],
    specks: [
      [0x2a5070, 0xb0e2f0],
      [0x2f5a76, 0xa8dcec],
      [0x2d5473, 0xa4d8ea],
      [0x35607d, 0x9fd4e8],
      [0x38668a, 0x9ed2e6],
      [0x3b6a86, 0x93cbe2],
    ],
  },
  gravel: {
    bases: [0x7f7d70, 0x767468, 0x7b7364, 0x747266, 0x6e6c60, 0x6b6a5f],
    specks: [
      [0x6a675a, 0xa5a396],
      [0x626053, 0x8d8b7e],
      [0x6f6656, 0xa8a08c],
      [0x605e52, 0x94927f],
      [0x5b594d, 0x9a988b],
      [0x585f66, 0x8a929a],
    ],
  },
  asphalt: {
    bases: [0x565f6c, 0x596270, 0x5b6472, 0x606a78],
    specks: [[0x4d5563, 0x707a88]],
  },
  concrete: {
    // Xám trung tính, hơi ấm — bê tông ngả xanh bị đọc thành mặt nước.
    bases: [0x949086, 0x969288, 0x9a968c, 0xa09c92],
    specks: [[0x8b877c, 0xa8a49a]],
  },
  dirtFringe: {
    bases: [0x776246, 0x7a6748, 0x7d6848, 0x82704e],
    specks: [[0x6a5738, 0x95805e]],
  },
  grassFringe: {
    bases: [0x497536, 0x4b7839, 0x4d7b3b, 0x4f7d3c, 0x53823f, 0x568642],
    specks: [[0x3d6730, 0x6ba24f]],
  },
  gravelFringe: {
    bases: [0x6e6c60, 0x727064, 0x747266, 0x7c7a6e],
    specks: [[0x626053, 0x8d8b7e]],
  },
}

/**
 * Grain terrains: a couple of lone specks, one small cluster, an occasional
 * scratch and a pebble with a lit top + dark base.
 *
 * Deliberately sparse. Pixel-art ground reads as *flat colour with a few
 * features*; at 16px a tile dense enough to look "textured" everywhere turns the
 * whole map into noise and the props stop standing out — measured the Stardew
 * look wants roughly one feature per 40–50px, not one per 10px.
 */
function grainGround(ctx: TilePaintContext, coarse: boolean): void {
  const { g, rnd, speckA, speckB } = ctx
  const grains = coarse ? 2 : 3
  for (let i = 0; i < grains; i++) {
    const x = Math.floor(rnd() * 15)
    const y = Math.floor(rnd() * 15)
    g.rect(x, y, 1, 1).fill({ color: rnd() < 0.5 ? speckA : speckB, alpha: 0.85 })
  }

  const clusters = coarse ? 1 : 1 + Math.floor(rnd() * 2)
  for (let c = 0; c < clusters; c++) {
    const cx = Math.floor(rnd() * 12)
    const cy = Math.floor(rnd() * 12)
    const count = 2 + Math.floor(rnd() * 2)
    for (let i = 0; i < count; i++) {
      g.rect(cx + Math.floor(rnd() * 4), cy + Math.floor(rnd() * 4), 1, 1).fill({
        color: rnd() < 0.5 ? speckA : speckB,
        alpha: 0.85,
      })
    }
  }

  if (rnd() > 0.7) {
    const x = Math.floor(rnd() * 11)
    const y = Math.floor(rnd() * 14)
    g.rect(x, y, 3 + Math.floor(rnd() * 2), 1).fill({ color: speckA, alpha: 0.7 })
  }

  if (rnd() < (coarse ? 0.9 : 0.7)) {
    const x = Math.floor(rnd() * 13)
    const y = 2 + Math.floor(rnd() * 11)
    g.rect(x, y + 1, 2, 1).fill({ color: speckA, alpha: 0.9 })
    g.rect(x, y, 1, 1).fill({ color: speckB, alpha: 0.95 })
    g.rect(x + 1, y, 1, 1).fill({ color: speckB, alpha: 0.7 })
  }

  if (rnd() < 0.5) {
    const x = Math.floor(rnd() * 11)
    const y = Math.floor(rnd() * 12)
    g.rect(x, y, 4, 2).fill({ color: 0x000000, alpha: 0.05 })
    g.rect(x + 1, y + 1, 2, 1).fill({ color: 0x000000, alpha: 0.05 })
  }
}

export function grainPaint(coarse: boolean): TilePaintFn {
  return (ctx) => grainGround(ctx, coarse)
}

/**
 * Water: calmer than dirt on purpose — a few horizontal ripple dashes, some
 * darker depth flecks and one soft reflection patch per tile.
 */
export const waterPaint: TilePaintFn = (ctx) => {
  const { g, rnd, speckA, speckB } = ctx
  for (let i = 0; i < 2; i++) {
    if (rnd() < 0.35) continue
    const x = Math.floor(rnd() * 11)
    const y = Math.floor(rnd() * 16)
    g.rect(x, y, 3 + Math.floor(rnd() * 3), 1).fill({ color: speckB, alpha: 0.45 })
  }
  for (let i = 0; i < 2; i++) {
    g.rect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1).fill({ color: speckA, alpha: 0.6 })
  }
  if (rnd() < 0.5) {
    const x = Math.floor(rnd() * 12)
    const y = Math.floor(rnd() * 13)
    g.rect(x, y, 4, 1).fill({ color: speckB, alpha: 0.22 })
    g.rect(x + 1, y + 1, 2, 1).fill({ color: speckB, alpha: 0.16 })
  }
}

/** Grass/asphalt/concrete stay close to flat: a few specks, nothing more. */
export const plainPaint: TilePaintFn = (ctx) => {
  const { g, rnd, speckA, speckB } = ctx
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rnd() * 31) / 2
    const y = Math.floor(rnd() * 31) / 2
    g.rect(x, y, 1, 1).fill({ color: i % 2 === 0 ? speckA : speckB, alpha: 0.8 })
  }
  const blotchX = Math.floor(rnd() * 27) / 2
  const blotchY = Math.floor(rnd() * 27) / 2
  g.rect(blotchX, blotchY, 3, 2).fill({ color: 0x000000, alpha: 0.05 })
}

/** Three upright blades so grass and grass-fringe tiles read as living turf. */
export function grassBlades(g: Graphics, rnd: () => number): void {
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rnd() * 29) / 2
    const y = Math.floor(rnd() * 27) / 2
    g.rect(x, y, 1, 3).fill({ color: 0x7cba55, alpha: 0.85 })
  }
}

/** Weedy blades for dirt/gravel fringe tiles. */
export function fringeWeeds(g: Graphics, rnd: () => number): void {
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rnd() * 27) / 2
    const y = Math.floor(rnd() * 27) / 2
    g.rect(x, y, 1, 3).fill({ color: 0x74a05f, alpha: 0.85 })
  }
}

/** A few specks of the dirt underneath poking through a grass-fringe tile. */
export function fringeSpecks(g: Graphics, rnd: () => number): void {
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rnd() * 31) / 2
    const y = Math.floor(rnd() * 31) / 2
    g.rect(x, y, 1, 1).fill({ color: 0x8a7550, alpha: 0.85 })
  }
}

/** Slab seams so concrete reads as poured panels. */
export function concreteSeams(g: Graphics): void {
  g.rect(0, 0, 16, 1).fill({ color: 0x000000, alpha: 0.15 })
  g.rect(0, 0, 1, 16).fill({ color: 0x000000, alpha: 0.12 })
}

/** The odd crack on an asphalt tile. */
export function asphaltCrack(g: Graphics, rnd: () => number): void {
  if (rnd() > 0.6) g.rect(2, Math.floor(rnd() * 23) / 2 + 2, 10, 1).fill({ color: 0x474e59, alpha: 0.7 })
}
