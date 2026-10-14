import { Container, Graphics, Rectangle, type Renderer, type Texture } from 'pixi.js'
import { TILE_SIZE } from './metrics'
import type { TerrainId } from './terrain'
import { makeRandom } from './random'
import type { GroundPack } from './pack'

export type TileSet = Record<TerrainId, Texture[]>

/**
 * Builds one texture list per terrain of the pack: `def.bases.length` variants,
 * drawn by the pack's own tile painter. The seed walks the terrain list in
 * order — that is why `pack.terrains` keeps a fixed order (reordering it re-rolls
 * every later terrain's grain).
 */
export function generateTileSet(renderer: Renderer, pack: GroundPack): TileSet {
  const set = {} as TileSet
  let seed = 11
  for (const def of pack.terrains) {
    const textures: Texture[] = []
    for (let variant = 0; variant < def.bases.length; variant++) {
      const tile = paintTile(def, variant, seed)
      seed += 7
      textures.push(
        renderer.generateTexture({ target: tile, frame: new Rectangle(0, 0, TILE_SIZE, TILE_SIZE), resolution: 1 }),
      )
    }
    set[def.id] = textures
  }
  return set
}

/** How many tone variants a terrain has. */
export function tileVariantCount(pack: GroundPack, kind: TerrainId): number {
  return terrainOf(pack, kind).bases.length
}

/**
 * Base tone of one variant. Dithering a patch border has to use *this*, not the
 * grain tones: the grain pair sits ~30% away from the base, so sprinkling it only
 * adds light/dark dots (noise) instead of easing one tone into the next.
 */
export function tileBaseTone(pack: GroundPack, kind: TerrainId, variant: number): number {
  const bases = terrainOf(pack, kind).bases
  return bases[variant % bases.length] ?? 0x808080
}

function terrainOf(pack: GroundPack, kind: TerrainId): GroundPack['terrains'][number] {
  const def = pack.terrains.find((terrain) => terrain.id === kind)
  if (!def) throw new Error(`ground pack "${pack.id}" has no terrain "${kind}"`)
  return def
}

function paintTile(def: GroundPack['terrains'][number], variant: number, seed: number): Container {
  const rnd = makeRandom(seed * 7919)
  const base = def.bases[variant % def.bases.length] ?? 0x808080
  const pair = def.specks[variant % def.specks.length] ?? [0x808080, 0x909090]
  const speckA = pair[0]
  const speckB = pair[1]

  const container = new Container()
  const g = new Graphics().rect(0, 0, TILE_SIZE, TILE_SIZE).fill(base)
  def.paint({ g, rnd, variant, base, speckA, speckB })
  def.extra?.(g, rnd)
  container.addChild(g)
  return container
}
