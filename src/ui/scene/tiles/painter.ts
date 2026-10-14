import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js'
import { makeRandom } from '../random'
import { insideAnyRect, type ZoneRect } from '../zoneLayout'
import { paintDragMarks, paintPuddle } from './dirtDetail'
import { generateEdgeTiles } from './edgeTiles'
import { TILE_SIZE, blobContour, cornerHash, cornerMask, rectContour } from './edgeGeometry'
import { paintWallBands } from './wallBands'
import { contourSteps } from './groundCanvas'
import {
  DEBRIS_KINDS,
  drawDebrisItem,
  drawFloraItem,
  drawWaterItem,
  pickDebrisKind,
  pickFloraKind,
  pickWaterKind,
} from './groundItems'
import { EDGE_TONES, terrainTones, type TileKind } from './terrain'
import { generateTileSet, tileBaseTone, type TileSet } from './tileSet'
import { boundaryDitherWeight, groundTint, groundVariant, scatterDensity, scatterMix, variantBoundaryBlend } from './variety'
import { paintShore } from './waterDetail'

export interface MaskedOptions {
  /** Draw the thin border stroke around the rect (roads keep theirs). */
  border?: boolean
}

export type ScatterVariant = 'flora' | 'debris' | 'water'

/** Bề rộng vùng đệm khi rải rác trong một khu (tránh sát mép). */
const SCATTER_MARGIN = 6

/**
 * Dither budget at a tonal patch border: fraction of the tile area sprinkled at
 * the closest point of the border. Carried by *density*, not alpha, so the whole
 * dither pass keeps one fill style and batches as a single draw.
 */
const DITHER_MAX_DENSITY = 0.35
const DITHER_ALPHA = 0.6

/**
 * Terrains whose textures are isotropic, so rotating/flipping a cell hides
 * repetition. Grass and the fringe kinds keep blades pointing up, so they are
 * excluded.
 */
const ORIENTABLE: Record<TileKind, boolean> = {
  grass: false,
  dirt: true,
  water: true,
  gravel: true,
  asphalt: true,
  concrete: true,
  dirtFringe: false,
  grassFringe: false,
  gravelFringe: false,
}

/**
 * Paints regions from a generated TileSet.
 *
 * - `paint` / `paintMasked`: straight areas (roads, slabs) with an optional stroke.
 * - `paintBlob`: organic clearings. The contour is resolved **per tile** from a
 *   4-corner mask (corner samples jittered by a position hash, shared between
 *   neighbouring tiles so the outline never cracks) and drawn from the generated
 *   edge-tile set — grass lip, occlusion rim, inside tones. The clearing then
 *   gets tonal patches, litter along its edge and grass overhang, so dirt reads
 *   as a dug-out clearing instead of a flat brown shape.
 * - `patchwork` / `scatter`: large tonal variation and dense per-cell detail.
 */
export class TilePainter {
  private readonly renderer: Renderer
  private readonly set: TileSet
  private readonly edgeCache = new Map<string, (Texture[] | undefined)[]>()

  constructor(renderer: Renderer, set?: TileSet) {
    this.renderer = renderer
    this.set = set ?? generateTileSet(renderer)
  }

  /** Fills `rect` with tiles, aligned to the tile grid. Partial cells overflow. */
  paint(container: Container, rect: ZoneRect, kind: TileKind, seed: number): void {
    const textures = this.set[kind]
    if (textures.length === 0) return

    const dither = new Graphics()
    const startX = Math.floor(rect.x / TILE_SIZE) * TILE_SIZE
    const startY = Math.floor(rect.y / TILE_SIZE) * TILE_SIZE
    const endX = rect.x + rect.width
    const endY = rect.y + rect.height

    for (let y = startY; y < endY; y += TILE_SIZE) {
      for (let x = startX; x < endX; x += TILE_SIZE) {
        this.addTile(container, dither, kind, x, y, seed)
      }
    }
    container.addChild(dither)
  }

  /** Straight-edged area (roads, slabs) with optional border stroke. */
  paintMasked(root: Container, rect: ZoneRect, kind: TileKind, seed: number, options: MaskedOptions = {}): void {
    const layer = new Container()
    const mask = new Graphics().rect(rect.x, rect.y, rect.width, rect.height).fill(0xffffff)
    root.addChild(layer, mask)
    layer.mask = mask

    this.paint(layer, rect, kind, seed)

    if (options.border !== false) {
      const border = new Graphics()
        .rect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1)
        .stroke({ width: 0.5, color: 0x55604f, alpha: 0.5 })
      root.addChild(border)
    }
  }

  /**
   * A clearing blended into its surroundings.
   *
   * The edge is **tile-based on purpose**: the outline (`blobContour`) is an
   * ellipse roughened at the tile scale, and the 16-case autotile turns it into a
   * jagged, grid-aligned border — the pixel-art look. Masking the tiles to the
   * polygon (and painting a ribbon along it) gave a smooth vector edge, which
   * reads as artificial and loses the grid. Interior dressing (tones, clusters,
   * litter, usage traces, water scatter) *is* clipped to the polygon so nothing
   * spills onto the neighbours. A raised `elevation` adds the plateau wall.
   */
  paintBlob(
    root: Container,
    rect: ZoneRect,
    kind: TileKind,
    seed: number,
    pad = 10,
    outside: TileKind = 'grass',
    elevation = 0,
  ): void {
    const points = blobContour(rect, pad, seed)

    const tileLayer = new Container()
    root.addChild(tileLayer)
    this.paintTiles(tileLayer, rect, pad, points, seed, kind, outside)

    // Tông nền, cụm chi tiết, rác mép, chuyện nền: cắt theo đa giác nên không tràn ra.
    const dressed = new Container()
    const clip = new Graphics().poly(points).fill(0xffffff)
    root.addChild(dressed, clip)
    dressed.mask = clip
    this.tonesInside(dressed, rect, pad, seed, kind)
    this.clustersInside(dressed, rect, pad, seed, kind)
    this.litterInside(dressed, points, seed, kind)
    this.groundStories(dressed, rect, pad, seed, kind)
    if (kind === 'water') this.scatter(dressed, rect, seed * 7 + 3, 'water', 26)

    if (elevation > 0) {
      const wall = new Graphics()
      paintWallBands(wall, points, kind)
      root.addChild(wall)
    }

    if (kind === 'water') {
      const shore = new Graphics()
      paintShore(shore, points, seed)
      root.addChild(shore)
    } else {
      this.fringeInside(root, points, seed, outside, kind)
    }
  }

  /**
   * Straight ground band (a path). A blob would taper at the ends, which pinches
   * the link between a zone and the road; a band keeps one width all the way and
   * the tile grid roughens its sides for free — **but only when the contour
   * wobbles** (`jitter`, pass it for dirt tracks): a perfectly straight band
   * renders as a ruler line with a uniform edge-tile row, which reads as a pasted
   * rectangle. Roads and slabs keep `jitter = 0`.
   *
   * Dirt/gravel bands also get the **same interior dressing as a clearing**
   * (tonal patches, pebble clusters, litter along the edges, a puddle or drag
   * marks), clipped to the band outline — a path is a place people work, not a
   * bare strip of tiles.
   */
  paintPath(
    root: Container,
    rect: ZoneRect,
    kind: TileKind,
    seed: number,
    outside: TileKind = 'grass',
    flare = 0,
    ramp = flare,
    mouths: 'both' | 'top' | 'bottom' = 'both',
    jitter = 0,
  ): void {
    const points = rectContour(rect, flare, ramp, mouths, jitter)
    const tileLayer = new Container()
    root.addChild(tileLayer)
    this.paintTiles(tileLayer, rect, 0, points, seed, kind, outside)

    const dressed = new Container()
    const clip = new Graphics().poly(points).fill(0xffffff)
    root.addChild(dressed, clip)
    dressed.mask = clip
    this.tonesInside(dressed, rect, 0, seed, kind)
    this.clustersInside(dressed, rect, 0, seed, kind)
    this.litterInside(dressed, points, seed, kind)
    this.groundStories(dressed, rect, 0, seed, kind)

    this.fringeInside(root, points, seed, outside, kind)
  }

  /** Lays the ground tiles for a region, using `points` to pick the edge cases. */
  private paintTiles(
    container: Container,
    rect: ZoneRect,
    pad: number,
    points: readonly number[],
    seed: number,
    kind: TileKind,
    outside: TileKind,
  ): void {
    // Same terrain on both sides means the "edge" is between two stretches of one
    // material (a zone floor inside the patch of the same dirt): transition tiles
    // would draw a lip and an occlusion ring around nothing, which is exactly the
    // seam that makes a floor look pasted on. Plain tiles + the interior dressing
    // merge it instead.
    const edges = kind === outside ? [] : this.edgesFor(kind, outside)
    const dither = new Graphics()
    const startX = Math.floor((rect.x - pad - TILE_SIZE) / TILE_SIZE) * TILE_SIZE
    const startY = Math.floor((rect.y - pad - TILE_SIZE) / TILE_SIZE) * TILE_SIZE
    const endX = rect.x + rect.width + pad + TILE_SIZE
    const endY = rect.y + rect.height + pad + TILE_SIZE

    for (let y = startY; y < endY; y += TILE_SIZE) {
      for (let x = startX; x < endX; x += TILE_SIZE) {
        const mask = cornerMask(x, y, points, seed)
        if (mask === 0) continue
        if (mask === 15) {
          this.addTile(container, dither, kind, x, y, seed)
          continue
        }
        const variants = edges[mask]
        if (!variants || variants.length === 0) {
          this.addTile(container, dither, kind, x, y, seed)
          continue
        }
        this.addTexture(container, variants, x, y, seed)
      }
    }
    container.addChild(dither)
  }

  /** Large soft tonal patches so grass reads as terrain, not one flat mass. */
  patchwork(container: Container, rect: ZoneRect, seed: number, block = 96): void {
    const rnd = makeRandom(seed)
    const g = new Graphics()
    for (let y = rect.y; y < rect.y + rect.height; y += block) {
      for (let x = rect.x; x < rect.x + rect.width; x += block) {
        if (rnd() > 0.45) continue
        const cx = Math.round(x + block * (0.25 + rnd() * 0.5))
        const cy = Math.round(y + block * (0.25 + rnd() * 0.5))
        const rx = 16 + rnd() * 18
        const ry = 9 + rnd() * 12
        const dark = rnd() < 0.5
        g.ellipse(cx, cy, rx, ry).fill({ color: dark ? 0x2f4029 : 0x8cc46a, alpha: dark ? 0.1 : 0.08 })
      }
    }
    container.addChild(g)
  }

  /**
   * Dense scatter detail. Density comes from the low-frequency `scatterDensity`
   * field, so clutter gathers into drifts and whole patches stay swept clean
   * instead of an even sprinkle; `scatterMix` biases what each drift holds
   * (flowers vs tufts, stones vs twigs). `flora` belongs on grass — paint it
   * before the dirt blobs so clearings stay clean. `debris` works on any terrain.
   *
   * `skip` lists no-go rects (the zones plus their floor lip — see
   * `worldGrounds.SCATTER_SKIP`): specimens landing there are dropped. The kind
   * is still drawn from the RNG *before* the check, so clearing a region never
   * shifts the rest of the map's scatter by one draw.
   */
  scatter(
    container: Container,
    rect: ZoneRect,
    seed: number,
    variant: ScatterVariant = 'debris',
    cell = 22,
    skip: readonly ZoneRect[] = [],
  ): void {
    const rnd = makeRandom(seed)
    const g = new Graphics()
    for (let y = rect.y + SCATTER_MARGIN; y < rect.y + rect.height - SCATTER_MARGIN; y += cell) {
      for (let x = rect.x + SCATTER_MARGIN; x < rect.x + rect.width - SCATTER_MARGIN; x += cell) {
        const cx = Math.round(x + rnd() * (cell - SCATTER_MARGIN))
        const cy = Math.round(y + rnd() * (cell - SCATTER_MARGIN))
        const density = scatterDensity(cx, cy, seed) * (variant === 'water' ? 0.85 : 1)
        // Ngưỡng đẩy cao: nền phần lớn phải SẠCH, rác chỉ tụ thành cụm rõ rệt —
        // rắc đều tay (ngưỡng cũ) làm cả map thành "trường chấm bi".
        const clean = variant === 'water' ? 0.4 : 0.3
        const maxCount = variant === 'water' ? 2 : 3
        const count = density < clean ? 0 : density < 0.7 ? 1 : density < 0.92 ? 2 : maxCount
        const mix = scatterMix(cx, cy, seed)
        for (let i = 0; i < count; i++) {
          if (i > 0 && rnd() > density) break
          const px = i === 0 ? cx : Math.round(cx + (rnd() - 0.5) * cell * 0.8)
          const py = i === 0 ? cy : Math.round(cy + (rnd() - 0.5) * cell * 0.8)
          const kind =
            variant === 'flora'
              ? pickFloraKind(mix, rnd)
              : variant === 'water'
                ? pickWaterKind(mix, rnd)
                : pickDebrisKind(mix, rnd)
          if (insideAnyRect(skip, px, py)) continue
          if (variant === 'flora') drawFloraItem(g, px, py, kind, rnd)
          else if (variant === 'water') drawWaterItem(g, px, py, kind, rnd)
          else drawDebrisItem(g, px, py, kind, rnd)
        }
      }
    }
    container.addChild(g)
  }

  private edgesFor(kind: TileKind, outside: TileKind): (Texture[] | undefined)[] {
    const key = `${kind}|${outside}`
    let edges = this.edgeCache.get(key)
    if (!edges) {
      edges = generateEdgeTiles(this.renderer, kind, outside)
      this.edgeCache.set(key, edges)
    }
    return edges
  }

  /** Places one tile from a variant list (edge or interior sets). */
  private addTexture(container: Container, variants: Texture[], x: number, y: number, seed: number): void {
    const texture = variants[groundVariant(x, y, variants.length, seed)]
    if (!texture) return
    const sprite = new Sprite(texture)
    sprite.position.set(x, y)
    sprite.tint = groundTint(x, y, seed)
    container.addChild(sprite)
  }

  private addTile(container: Container, dither: Graphics, kind: TileKind, x: number, y: number, seed: number): void {
    const textures = this.set[kind]
    const count = textures.length
    const salt = seed + KIND_OFFSET[kind]
    const variant = groundVariant(x, y, count, salt)
    const texture = textures[variant]
    if (!texture) return

    const sprite = new Sprite(texture)
    sprite.tint = groundTint(x, y, salt)
    if (ORIENTABLE[kind]) {
      // Xoay/lật hạt để cùng một texture không bao giờ lặp y hệt.
      const h = cornerHash(x, y, seed * 7919 + 11)
      sprite.pivot.set(TILE_SIZE / 2, TILE_SIZE / 2)
      sprite.position.set(x + TILE_SIZE / 2, y + TILE_SIZE / 2)
      sprite.rotation = ((h >> 1) & 3) * (Math.PI / 2)
      sprite.scale.set((h & 1) === 1 ? -1 : 1, (h & 4) === 4 ? -1 : 1)
    } else {
      sprite.position.set(x, y)
    }
    container.addChild(sprite)

    this.ditherBorder(dither, kind, x, y, count, salt)
  }

  /**
   * Dissolves the step between two tonal patches.
   *
   * A tile that abuts a *different* tone gets its neighbour's **base** tone
   * sprinkled over it, **dense on the edge that abuts the neighbour and fading
   * inwards** (`boundaryDitherWeight`), so the seam reads as a gradient. Three
   * things matter and the first two were wrong before:
   *
   * 1. the dither colour is the neighbour's **base** tone, not its grain tones —
   *    the grain pair sits ~30% away from the base, so the old dither sprinkled
   *    light/dark dots that read as noise instead of easing one tone into the next;
   * 2. the specks are weighted toward the shared edge. Sprinkling the whole tile
   *    evenly made every boundary tile a speckled rectangle, and on a narrow band
   *    (the alley lane) the boundary ran along it for tiles on end;
   * 3. density (not alpha) carries the blend, so the whole pass keeps one fill
   *    style and batches as a single draw.
   */
  private ditherBorder(
    dither: Graphics,
    kind: TileKind,
    x: number,
    y: number,
    count: number,
    salt: number,
  ): void {
    if (count < 2) return
    const blend = variantBoundaryBlend(x, y, count, salt)
    if (!blend || blend.amount <= 0.05) return

    const tone = tileBaseTone(kind, blend.variant)
    const rnd = makeRandom(cornerHash(x, y, salt * 457 + 31))
    const specks = Math.round(TILE_SIZE * TILE_SIZE * DITHER_MAX_DENSITY * blend.amount)
    for (let i = 0; i < specks; i++) {
      const px = Math.round(x + rnd() * (TILE_SIZE - 1))
      const py = Math.round(y + rnd() * (TILE_SIZE - 1))
      if (rnd() > boundaryDitherWeight(x, y, px, py, count, salt)) continue
      dither.rect(px, py, 1, 1).fill({ color: tone, alpha: DITHER_ALPHA })
    }
  }

  /**
   * Mid-scale patchiness inside a clearing, driven by the same density field as
   * the scatter: clean regions only get a lighter wash (and no extra litter),
   * dense regions get a tight cluster of pebbles/stones. Keeps the two passes
   * from stacking into uniform clutter.
   */
  private clustersInside(layer: Container, rect: ZoneRect, pad: number, seed: number, kind: TileKind): void {
    if (kind !== 'dirt' && kind !== 'gravel') return
    const tones = EDGE_TONES[kind]
    const rnd = makeRandom(seed * 91 + 13)
    const g = new Graphics()
    const region = 52

    for (let y = rect.y - pad; y < rect.y + rect.height + pad; y += region) {
      for (let x = rect.x - pad; x < rect.x + rect.width + pad; x += region) {
        const cx = Math.round(x + rnd() * region)
        const cy = Math.round(y + rnd() * region)
        const density = scatterDensity(cx, cy, seed)
        if (density < 0.25) {
          // swept clean: nhạt đất, cố tình KHÔNG thêm sỏi (lớp scatter cũng bỏ qua vùng này)
          g.ellipse(cx, cy, 10 + rnd() * 8, 6 + rnd() * 5).fill({ color: tones?.light ?? 0xa08a63, alpha: 0.1 })
          continue
        }
        if (density < 0.55 || rnd() > 0.7) continue
        const count = 3 + Math.floor(rnd() * 4)
        for (let i = 0; i < count; i++) {
          drawDebrisItem(
            g,
            cx + Math.round((rnd() - 0.5) * 14),
            cy + Math.round((rnd() - 0.5) * 10),
            Math.floor(rnd() * DEBRIS_KINDS),
            rnd,
          )
        }
      }
    }

    layer.addChild(g)
  }

  /** Generic stories every clearing gets: a puddle in a dip and drag marks. */
  private groundStories(layer: Container, rect: ZoneRect, pad: number, seed: number, kind: TileKind): void {
    if (kind !== 'dirt' && kind !== 'gravel') return
    const rnd = makeRandom(seed * 37 + 29)
    const g = new Graphics()
    const spanX = rect.width + pad * 2
    const spanY = rect.height + pad * 2

    const puddles = 1 + Math.floor(rnd() * 2)
    for (let i = 0; i < puddles; i++) {
      paintPuddle(
        g,
        Math.round(rect.x - pad + rnd() * spanX),
        Math.round(rect.y - pad + rnd() * spanY),
        4 + rnd() * 4,
        2 + rnd() * 2,
        seed + i * 11,
      )
    }

    if (rnd() < 0.35) {
      const x = Math.round(rect.x - pad + rnd() * spanX)
      const y = Math.round(rect.y - pad + rnd() * spanY)
      const length = 8 + rnd() * 10
      const dir = rnd() < 0.5 ? 1 : -1
      paintDragMarks(g, [{ x, y }, { x: x + length * dir, y: y + (rnd() - 0.5) * 4 }], {
        seed: seed + 5,
        strength: 0.55,
      })
    }

    layer.addChild(g)
  }

  /** Tonal patches inside a clearing so the inside is not one flat mass. */
  private tonesInside(layer: Container, rect: ZoneRect, pad: number, seed: number, kind: TileKind): void {
    const tones = EDGE_TONES[kind]
    if (!tones) return
    const rnd = makeRandom(seed * 53 + 19)
    const g = new Graphics()
    const step = 48
    for (let y = rect.y - pad; y < rect.y + rect.height + pad; y += step) {
      for (let x = rect.x - pad; x < rect.x + rect.width + pad; x += step) {
        if (rnd() > 0.6) continue
        const cx = Math.round(x + rnd() * step)
        const cy = Math.round(y + rnd() * step)
        const rx = 12 + rnd() * 16
        const ry = 7 + rnd() * 10
        const dark = rnd() < 0.5
        g.ellipse(cx, cy, rx, ry).fill({ color: dark ? tones.depth : tones.light, alpha: dark ? 0.07 : 0.05 })
      }
    }
    layer.addChild(g)
  }

  /** Pebbles and twigs gathering just inside the contour (dirt terrains only). */
  private litterInside(layer: Container, points: readonly number[], seed: number, kind: TileKind): void {
    if (kind !== 'dirt' && kind !== 'gravel') return
    const tones = EDGE_TONES[kind]
    const rnd = makeRandom(seed * 71 + 23)
    const g = new Graphics()
    for (const spot of contourSteps(points, 10)) {
      if (rnd() < 0.45) {
        const d = 3 + rnd() * 6
        const x = Math.round(spot.x + spot.inwardX * d)
        const y = Math.round(spot.y + spot.inwardY * d)
        if (rnd() < 0.5) g.rect(x, y, 1.5, 1).fill({ color: tones?.rim ?? 0x6a5738, alpha: 0.9 })
        else g.rect(x, y, 2, 1).fill({ color: tones?.light ?? 0x95805e, alpha: 0.85 })
      }
      if (rnd() < 0.3) {
        const d = 5 + rnd() * 8
        const x = Math.round(spot.x + spot.inwardX * d)
        const y = Math.round(spot.y + spot.inwardY * d)
        g.rect(x, y, 3, 0.75).fill({ color: 0x6b5136, alpha: 0.7 })
      }
    }
    layer.addChild(g)
  }

  /**
   * Fringe of the surrounding terrain creeping over the seam: grass tufts where
   * a clearing sits in grass, crumbled dirt and half-buried pebbles where it sits
   * in dirt (a muddy bank), plus a few pebbles lying on the outside either way.
   *
   * This is what makes a tile edge read as *natural* rather than cut: tufts stand
   * on both sides of the border and overlap each other, so the staircase steps get
   * covered by vegetation.
   */
  private fringeInside(
    root: Container,
    points: readonly number[],
    seed: number,
    outside: TileKind,
    innerKind: TileKind,
  ): void {
    const rnd = makeRandom(seed * 31 + 7)
    const g = new Graphics()
    const grassLike = outside === 'grass' || outside === 'grassFringe'
    const tones = terrainTones(outside)
    const inner = terrainTones(innerKind)

    for (const spot of contourSteps(points, 4)) {
      // Cụm cỏ mọc lấn vào trong mép (2–3 lá so le).
      if (rnd() < 0.85) {
        const d = 1 + rnd() * 3
        const x = Math.round(spot.x + spot.inwardX * d)
        const y = Math.round(spot.y + spot.inwardY * d)
        if (grassLike) {
          const height = 3 + Math.round(rnd())
          g.rect(x, y - height, 1, height).fill({ color: tones.base, alpha: 0.95 })
          if (rnd() < 0.75) g.rect(x + 1, y - height + 1, 1, height - 1).fill({ color: tones.light, alpha: 0.9 })
          if (rnd() < 0.5) g.rect(x - 1, y - height + 2, 1, height - 2).fill({ color: tones.depth, alpha: 0.85 })
        } else {
          g.rect(x, y - 1, 2, 1).fill({ color: tones.base, alpha: 0.85 })
          if (rnd() < 0.5) g.rect(x + 1, y - 2, 1, 1).fill({ color: tones.light, alpha: 0.8 })
        }
      }
      // Vài lá cỏ mọc hẳn RA NGOÀI mép, chồng lên ranh giới.
      if (grassLike && rnd() < 0.5) {
        const d = 1 + rnd() * 2
        const x = Math.round(spot.x - spot.inwardX * d)
        const y = Math.round(spot.y - spot.inwardY * d)
        g.rect(x, y - 4, 1, 4).fill({ color: tones.depth, alpha: 0.9 })
        if (rnd() < 0.5) g.rect(x + 1, y - 3, 1, 3).fill({ color: tones.base, alpha: 0.9 })
      }
      // Vụn của nền trong rơi ra ngoài mép.
      if (rnd() < 0.3) {
        const d = 1 + rnd() * 2
        const x = Math.round(spot.x - spot.inwardX * d)
        const y = Math.round(spot.y - spot.inwardY * d)
        g.rect(x, y, 1, 1).fill({ color: inner.base, alpha: 0.85 })
      }
      // Sỏi / đá / cục đất vụn cỡ khác nhau nằm dọc mép: phá các đoạn thẳng mà
      // lưới ô tạo ra, để ranh giới không bao giờ có cạnh sạch.
      if (rnd() < 0.45) {
        const d = rnd() * 3
        const x = Math.round(spot.x + spot.inwardX * d)
        const y = Math.round(spot.y + spot.inwardY * d)
        const size = rnd()
        if (size < 0.45) {
          g.rect(x, y, 1, 1).fill({ color: 0x8d8b7e, alpha: 0.85 })
        } else if (size < 0.75) {
          g.rect(x, y, 2, 1).fill({ color: 0x9c9a8c, alpha: 0.9 })
          g.rect(x, y - 1, 1, 1).fill({ color: 0xb5b3a4, alpha: 0.85 })
          g.rect(x, y + 1, 2, 1).fill({ color: 0x5b5346, alpha: 0.3 })
        } else {
          g.rect(x, y, 3, 2).fill({ color: 0x8a8779, alpha: 0.95 })
          g.rect(x, y - 1, 2, 1).fill({ color: 0xafad9e, alpha: 0.9 })
          g.rect(x + 2, y + 1, 1, 1).fill({ color: 0x5b5346, alpha: 0.45 })
          g.rect(x, y + 2, 3, 1).fill({ color: 0x4a4436, alpha: 0.22 })
        }
      }
      // Cục đất vụn của nền trong, rơi lấm tấm qua ranh giới.
      if (rnd() < 0.3) {
        const d = 1 + rnd() * 2
        const x = Math.round(spot.x - spot.inwardX * d)
        const y = Math.round(spot.y - spot.inwardY * d)
        const width = rnd() < 0.5 ? 2 : 3
        g.rect(x, y, width, 1).fill({ color: inner.base, alpha: 0.9 })
        if (rnd() < 0.4) g.rect(x, y - 1, 1, 1).fill({ color: inner.light, alpha: 0.85 })
        g.rect(x, y + 1, width, 1).fill({ color: 0x000000, alpha: 0.12 })
      }
      // Cỏ dại mọc lẻn vào mép đất.
      if (grassLike && rnd() < 0.35) {
        const d = rnd() * 3
        const x = Math.round(spot.x + spot.inwardX * d)
        const y = Math.round(spot.y + spot.inwardY * d)
        g.rect(x, y - 2, 1, 2).fill({ color: 0x4d6b33, alpha: 0.9 })
        g.rect(x + 1, y - 3, 1, 3).fill({ color: 0x628a3f, alpha: 0.85 })
        if (rnd() < 0.5) g.rect(x + 2, y - 2, 1, 2).fill({ color: 0x4d6b33, alpha: 0.85 })
      }
    }
    root.addChild(g)
  }
}

const KIND_OFFSET: Record<TileKind, number> = {
  grass: 1,
  dirt: 2,
  water: 3,
  gravel: 4,
  asphalt: 5,
  concrete: 6,
  dirtFringe: 7,
  grassFringe: 8,
  gravelFringe: 9,
}