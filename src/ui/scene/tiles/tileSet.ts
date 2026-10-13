import { Container, Graphics, Rectangle, Texture } from 'pixi.js'
import type { Renderer } from 'pixi.js'
import { makeRandom } from '../random'
import { TILE_KINDS, TILE_SIZE, type TileKind } from './terrain'

export { TILE_KINDS, TILE_SIZE, type TileKind } from './terrain'

export type TileSet = Record<TileKind, Texture[]>

interface TilePalette {
  /** One base tone per variant — dirt shifts hue (clay / ash / sand / damp), not just brightness. */
  bases: readonly number[]
  /** Speck tone pairs, one per variant (wraps when there are fewer entries than variants). */
  specks: readonly (readonly [number, number])[]
}

/**
 * Per-terrain palettes. Dirt carries the most variants on purpose: large
 * clearings are where repetition shows, so it mixes hue-shifted tones instead of
 * one brown. Numbers here are also the variant counts.
 */
const PALETTES: Record<TileKind, TilePalette> = {
  dirt: {
    // Tám tông lệch HUE nhưng cùng độ sáng (lệch ~±5%) — chênh sáng nhiều thì
    // biên mảng tông bị đọc thành các khối chữ nhật theo lưới tile.
    bases: [0x7f6a4a, 0x77684b, 0x83704f, 0x7c6b4c, 0x866b52, 0x746349, 0x817052, 0x7d694a],
    specks: [
      [0x6a5738, 0x95805e],
      [0x63513a, 0x9a8460],
      [0x715c3d, 0xa08a63],
      [0x665341, 0x8f7b58],
      [0x7a5240, 0xa8795c],
      [0x5c5245, 0x8c8474],
      [0x6f6242, 0xa39a74],
      [0x6a5540, 0x93795a],
    ],
  },
  water: {
    // Nước ao bãi phế liệu: xanh lục lam, hơi đục. Sáu tông chỉ lệch HUE ~±5%
    // về sáng — nước là mặt phẳng, chênh sáng nhiều thì mặt ao thành các ô vuông.
    bases: [0x4a80a2, 0x457a9c, 0x4e85a6, 0x43789a, 0x4b81a3, 0x477d9f],
    specks: [
      [0x35607d, 0x9fd4e8],
      [0x2f5a76, 0xa8dcec],
      [0x3b6a86, 0x93cbe2],
      [0x2a5070, 0xb0e2f0],
      [0x38668a, 0x9ed2e6],
      [0x2d5473, 0xa4d8ea],
    ],
  },
  gravel: {
    bases: [0x767468, 0x6e6c60, 0x7f7d70, 0x747266, 0x7b7364, 0x6b6a5f],
    specks: [
      [0x626053, 0x8d8b7e],
      [0x5b594d, 0x9a988b],
      [0x6a675a, 0xa5a396],
      [0x605e52, 0x94927f],
      [0x6f6656, 0xa8a08c],
      [0x585f66, 0x8a929a],
    ],
  },
  grass: {
    // Sáu tông chênh nhau rất ít (±4% sáng): bước tông nhỏ thì mảng tông trên cỏ
    // đọc ra là "cỏ sáng/tối" chứ không thành các ô vuông khác màu.
    bases: [0x4f7d3c, 0x4b7839, 0x53823f, 0x4d7b3b, 0x568642, 0x497536],
    specks: [[0x3d6730, 0x6ba24f]],
  },
  asphalt: {
    bases: [0x5b6472, 0x565f6c, 0x606a78, 0x596270],
    specks: [[0x4d5563, 0x707a88]],
  },
  concrete: {
    // Xám trung tính, hơi ấm — bê tông ngả xanh bị đọc thành mặt nước.
    bases: [0x9a968c, 0x949086, 0xa09c92, 0x969288],
    specks: [[0x8b877c, 0xa8a49a]],
  },
  dirtFringe: {
    bases: [0x7d6848, 0x776246, 0x82704e, 0x7a6748],
    specks: [[0x6a5738, 0x95805e]],
  },
  grassFringe: {
    bases: [0x4f7d3c, 0x4b7839, 0x53823f, 0x4d7b3b, 0x568642, 0x497536],
    specks: [[0x3d6730, 0x6ba24f]],
  },
  gravelFringe: {
    bases: [0x747266, 0x6e6c60, 0x7c7a6e, 0x727064],
    specks: [[0x626053, 0x8d8b7e]],
  },
}

/**
 * Reusable tile textures drawn from code: every kind gets deterministic variants
 * (dirt 8, gravel 6, the rest 4) plus dedicated transition kinds. Dirt/gravel are
 * painted as grain with clusters, scratches and shaded pebbles so the ground
 * reads as texture rather than uniform noise.
 */
export function generateTileSet(renderer: Renderer): TileSet {
  const set = {} as Record<TileKind, Texture[]>
  let seed = 11
  for (const kind of TILE_KINDS) {
    const palette = PALETTES[kind]
    const textures: Texture[] = []
    for (let variant = 0; variant < palette.bases.length; variant++) {
      const tile = paintTile(kind, variant, seed)
      seed += 7
      textures.push(
        renderer.generateTexture({ target: tile, frame: new Rectangle(0, 0, TILE_SIZE, TILE_SIZE), resolution: 1 }),
      )
    }
    set[kind] = textures
  }
  return set
}

/** How many tone variants a terrain has (dirt leads with 8). */
export function tileVariantCount(kind: TileKind): number {
  return PALETTES[kind].bases.length
}

/** Grain tones of one variant — the painter dithers these across patch borders. */
export function tileSpeckTones(kind: TileKind, variant: number): readonly [number, number] {
  const palette = PALETTES[kind]
  const pair = palette.specks[variant % palette.specks.length] ?? [0x808080, 0x909090]
  return [pair[0], pair[1]]
}

function paintTile(kind: TileKind, variant: number, seed: number): Container {
  const rnd = makeRandom(seed * 7919)
  const palette = PALETTES[kind]
  const base = palette.bases[variant % palette.bases.length] ?? 0x808080
  const pair = palette.specks[variant % palette.specks.length] ?? [0x808080, 0x909090]
  const speckA = pair[0]
  const speckB = pair[1]

  const container = new Container()
  const g = new Graphics().rect(0, 0, TILE_SIZE, TILE_SIZE).fill(base)

  if (kind === 'dirt' || kind === 'gravel') {
    paintGrainGround(g, rnd, speckA, speckB, kind === 'gravel')
  } else if (kind === 'water') {
    paintWaterGround(g, rnd, speckB, speckA)
  } else {
    paintPlainGround(g, rnd, speckA, speckB)
  }

  if (kind === 'grass' || kind === 'grassFringe') {
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rnd() * 29) / 2
      const y = Math.floor(rnd() * 27) / 2
      g.rect(x, y, 1, 3).fill({ color: 0x7cba55, alpha: 0.85 })
    }
  }
  if (kind === 'dirtFringe' || kind === 'gravelFringe') {
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rnd() * 27) / 2
      const y = Math.floor(rnd() * 27) / 2
      g.rect(x, y, 1, 3).fill({ color: 0x74a05f, alpha: 0.85 })
    }
  }
  if (kind === 'grassFringe') {
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(rnd() * 31) / 2
      const y = Math.floor(rnd() * 31) / 2
      g.rect(x, y, 1, 1).fill({ color: 0x8a7550, alpha: 0.85 })
    }
  }
  if (kind === 'concrete') {
    g.rect(0, 0, TILE_SIZE, 1).fill({ color: 0x000000, alpha: 0.15 })
    g.rect(0, 0, 1, TILE_SIZE).fill({ color: 0x000000, alpha: 0.12 })
  }
  if (kind === 'asphalt' && rnd() > 0.6) {
    g.rect(2, Math.floor(rnd() * 23) / 2 + 2, 10, 1).fill({ color: 0x474e59, alpha: 0.7 })
  }

  container.addChild(g)
  return container
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
function paintGrainGround(g: Graphics, rnd: () => number, speckA: number, speckB: number, coarse: boolean): void {
  const grains = coarse ? 2 : 3
  for (let i = 0; i < grains; i++) {
    const x = Math.floor(rnd() * (TILE_SIZE - 1))
    const y = Math.floor(rnd() * (TILE_SIZE - 1))
    g.rect(x, y, 1, 1).fill({ color: rnd() < 0.5 ? speckA : speckB, alpha: 0.85 })
  }

  const clusters = coarse ? 1 : 1 + Math.floor(rnd() * 2)
  for (let c = 0; c < clusters; c++) {
    const cx = Math.floor(rnd() * (TILE_SIZE - 4))
    const cy = Math.floor(rnd() * (TILE_SIZE - 4))
    const count = 2 + Math.floor(rnd() * 2)
    for (let i = 0; i < count; i++) {
      g.rect(cx + Math.floor(rnd() * 4), cy + Math.floor(rnd() * 4), 1, 1).fill({
        color: rnd() < 0.5 ? speckA : speckB,
        alpha: 0.85,
      })
    }
  }

  const scratches = 1
  for (let i = 0; i < scratches; i++) {
    if (rnd() < 0.7) continue
    const x = Math.floor(rnd() * (TILE_SIZE - 5))
    const y = Math.floor(rnd() * (TILE_SIZE - 2))
    g.rect(x, y, 3 + Math.floor(rnd() * 2), 1).fill({ color: speckA, alpha: 0.7 })
  }

  if (rnd() < (coarse ? 0.9 : 0.7)) {
    const x = Math.floor(rnd() * (TILE_SIZE - 3))
    const y = 2 + Math.floor(rnd() * (TILE_SIZE - 5))
    g.rect(x, y + 1, 2, 1).fill({ color: speckA, alpha: 0.9 })
    g.rect(x, y, 1, 1).fill({ color: speckB, alpha: 0.95 })
    g.rect(x + 1, y, 1, 1).fill({ color: speckB, alpha: 0.7 })
  }

  if (rnd() < 0.5) {
    const x = Math.floor(rnd() * (TILE_SIZE - 5))
    const y = Math.floor(rnd() * (TILE_SIZE - 4))
    g.rect(x, y, 4, 2).fill({ color: 0x000000, alpha: 0.05 })
    g.rect(x + 1, y + 1, 2, 1).fill({ color: 0x000000, alpha: 0.05 })
  }
}

/**
 * Water: calmer than dirt on purpose — a few horizontal ripple dashes, some
 * darker depth flecks and one soft reflection patch per tile.
 */
function paintWaterGround(g: Graphics, rnd: () => number, ripple: number, deep: number): void {
  for (let i = 0; i < 2; i++) {
    if (rnd() < 0.35) continue
    const x = Math.floor(rnd() * (TILE_SIZE - 5))
    const y = Math.floor(rnd() * TILE_SIZE)
    g.rect(x, y, 3 + Math.floor(rnd() * 3), 1).fill({ color: ripple, alpha: 0.45 })
  }
  for (let i = 0; i < 2; i++) {
    g.rect(Math.floor(rnd() * TILE_SIZE), Math.floor(rnd() * TILE_SIZE), 1, 1).fill({
      color: deep,
      alpha: 0.6,
    })
  }
  if (rnd() < 0.5) {
    const x = Math.floor(rnd() * (TILE_SIZE - 4))
    const y = Math.floor(rnd() * (TILE_SIZE - 3))
    g.rect(x, y, 4, 1).fill({ color: ripple, alpha: 0.22 })
    g.rect(x + 1, y + 1, 2, 1).fill({ color: ripple, alpha: 0.16 })
  }
}

/** Grass/asphalt/concrete stay close to flat: a few specks, nothing more. */
function paintPlainGround(g: Graphics, rnd: () => number, speckA: number, speckB: number): void {
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rnd() * 31) / 2
    const y = Math.floor(rnd() * 31) / 2
    g.rect(x, y, 1, 1).fill({ color: i % 2 === 0 ? speckA : speckB, alpha: 0.8 })
  }
  const blotchX = Math.floor(rnd() * 27) / 2
  const blotchY = Math.floor(rnd() * 27) / 2
  g.rect(blotchX, blotchY, 3, 2).fill({ color: 0x000000, alpha: 0.05 })
}