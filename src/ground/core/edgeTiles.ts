import { Container, Graphics, Rectangle, type Renderer, type Texture } from 'pixi.js'
import { makeRandom } from './random'
import {
  EDGE_SHAPES,
  TILE_SIZE,
  clipPolygonToTile,
  polygonCentroid,
  scaleAboutCentroid,
} from './edgeGeometry'
import type { TerrainDef } from './terrain'

const AO_COLOR = 0x2f2418

/**
 * Transition tiles for a terrain pair: one texture list per corner mask (index =
 * mask, undefined for 0/15 which use the plain tiles). Each tile carries the
 * *outside* terrain's lip — grass green where a clearing sits in grass, packed
 * mud where water meets dirt — plus the occlusion rim and the inside tones.
 *
 * These tiles **are** the visible boundary: the outline is sampled per tile
 * corner (`cornerMask`), so the edge comes out grid-aligned and jagged, and the
 * corner cases chamfer it. `fringeInside` then overlaps grass tufts across the
 * steps so it never reads as a cut.
 */
export function generateEdgeTiles(
  renderer: Renderer,
  inside: TerrainDef,
  outside: TerrainDef,
  variants = 2,
): (Texture[] | undefined)[] {
  const result: (Texture[] | undefined)[] = []
  for (let mask = 0; mask < 16; mask++) {
    const shapes = EDGE_SHAPES[mask]
    if (!shapes) {
      result[mask] = undefined
      continue
    }
    const textures: Texture[] = []
    for (let variant = 0; variant < variants; variant++) {
      const tile = paintEdgeTile(shapes, inside, outside, mask * 31 + variant * 7 + 3, variant)
      // Frame is forced to one tile so nothing a shape does can grow the texture.
      textures.push(
        renderer.generateTexture({ target: tile, frame: new Rectangle(0, 0, TILE_SIZE, TILE_SIZE), resolution: 1 }),
      )
    }
    result[mask] = textures
  }
  return result
}

function paintEdgeTile(
  shapes: readonly (readonly number[])[],
  inside: TerrainDef,
  outside: TerrainDef,
  seed: number,
  variant: number,
): Container {
  const rnd = makeRandom(seed * 7919)
  const inner = inside.tones
  const outer = outside.tones
  const tile = new Container()

  // Nền ngoài (cỏ hoặc bùn) + hạt đặc trưng của chính nền đó.
  const back = new Graphics().rect(0, 0, TILE_SIZE, TILE_SIZE).fill(outer.base)
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rnd() * (TILE_SIZE - 1))
    const y = Math.floor(rnd() * (TILE_SIZE - 1))
    back.rect(x, y, 1, 1).fill({ color: i % 2 === 0 ? outer.speckA : outer.speckB, alpha: 0.8 })
  }
  if (outside.grassLike) {
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(rnd() * (TILE_SIZE - 2))
      const y = Math.floor(rnd() * (TILE_SIZE - 4))
      back.rect(x, y, 1, 3).fill({ color: outer.light, alpha: 0.9 })
    }
  } else {
    // Nền đất/bùn: thay lá cỏ bằng sỏi nhỏ có đổ bóng.
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(rnd() * (TILE_SIZE - 3))
      const y = 1 + Math.floor(rnd() * (TILE_SIZE - 4))
      back.rect(x, y + 1, 2, 1).fill({ color: outer.depth, alpha: 0.7 })
      back.rect(x, y, 1, 1).fill({ color: outer.light, alpha: 0.8 })
    }
  }
  tile.addChild(back)

  const art = new Graphics()
  for (const shape of shapes) {
    const points = perturb(shape, variant, rnd)
    const centroid = polygonCentroid(points)
    // Bóng mềm quanh miệng hố → môi của nền ngoài → viền tối → tông nền trong.
    fillScaled(art, points, centroid, 1.3, { color: AO_COLOR, alpha: 0.12 })
    fillScaled(art, points, centroid, 1.26, { color: outer.light, alpha: 1 })
    fillScaled(art, points, centroid, 1.12, { color: outer.base, alpha: 0.85 })
    fillScaled(art, points, centroid, 1.06, { color: inner.rim, alpha: 1 })
    fillScaled(art, points, centroid, 1, { color: inner.base, alpha: 1 })

    for (let i = 0; i < 4; i++) {
      const cx = centroid.x + (rnd() - 0.5) * 10
      const cy = centroid.y + (rnd() - 0.5) * 10
      art.rect(Math.round(cx), Math.round(cy), 1, 1).fill({
        color: i % 2 === 0 ? inner.speckA : inner.speckB,
        alpha: 0.8,
      })
    }
  }
  tile.addChild(art)
  return tile
}

/** Bends a few contour points so neighbouring tiles of the same case differ. */
function perturb(points: readonly number[], variant: number, rnd: () => number): number[] {
  if (variant === 0) return [...points]
  const out: number[] = []
  for (let i = 0; i < points.length; i += 2) {
    const step = i / 2
    const dx = step % 3 === 0 ? (rnd() < 0.5 ? -1 : 1) : 0
    const dy = step % 4 === 1 ? (rnd() < 0.5 ? -1 : 1) : 0
    out.push((points[i] ?? 0) + dx, (points[i + 1] ?? 0) + dy)
  }
  return out
}

function fillScaled(
  g: Graphics,
  points: readonly number[],
  centroid: { x: number; y: number },
  factor: number,
  style: { color: number; alpha: number },
): void {
  const clipped = clipPolygonToTile(scaleAboutCentroid(points, centroid, factor))
  if (clipped.length >= 6) g.poly(clipped).fill(style)
}