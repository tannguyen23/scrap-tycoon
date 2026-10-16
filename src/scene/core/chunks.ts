import type { Rect } from '@ground/core/metrics'
import type { TilePainter } from '@ground/core/painter'
import { Container, Graphics, Rectangle, Sprite, type Renderer, type Texture } from 'pixi.js'

/**
 * Chunked ground painting: a big world is painted in square chunks, each baked
 * into its own texture and only kept while it is near the view. The kit owns the
 * machinery; the project owns the paint pass (`pack.ground.paint`, which takes a
 * window rect). Painting is position-anchored, so a chunk that is evicted and
 * later painted again comes back identical.
 *
 * A chunk is painted and baked in **horizontal bands**, one band per update, each
 * band into its own throwaway containers. That is what keeps a rebuild from
 * hitching: a chunk's cost (measured at ~120ms as one shot — tile sprites, scatter
 * and the vertex build behind every bake) lands as a dozen frames of ~10ms, and a
 * finished band is on screen before the next one starts.
 *
 * Two layers come out of every bake: `ground` (under the water layer) and `decor`
 * (above it), so hand-placed decor keeps occluding the water life exactly as the
 * full-map pass did.
 */

/** Paints one project's map, restricted to `window` when the map is chunked. */
export type ChunkPaint = (painter: TilePainter, ground: Container, decor: Graphics, window?: Rect) => void

export interface ChunkedGroundOptions {
  readonly renderer: Renderer
  readonly painter: TilePainter
  readonly paint: ChunkPaint
  readonly world: { readonly width: number; readonly height: number }
  /** Chunk edge, design px. A chunk bakes into one texture of this size. */
  readonly chunkSize?: number
  /** A chunk paints this far past its own edges, so a seam gets art from both sides. */
  readonly padding?: number
  /** Chunks this many cells outside the view stay painted. */
  readonly margin?: number
  /** Height of one paint+bake band, in design px. Smaller = smoother, more frames. */
  readonly bandHeight?: number
  /** Rebuild work allowed per `update`, in milliseconds. */
  readonly budgetMs?: number
}

export interface ChunkCoord {
  readonly cx: number
  readonly cy: number
}

export interface ChunkedGround {
  /** Ground art: under the water layer. */
  readonly ground: Container
  /** Hand-placed decor: above the water layer, below the zone detail scenes. */
  readonly decor: Container
  /** Paints missing bands and evicts the far chunks. Call every frame with the view. */
  update(view: Rect): void
  destroy(): void
}

const DEFAULT_CHUNK_SIZE = 512
/**
 * A chunk paints this far past its own edges: tiles straddle a seam (16px), the
 * fringe/litter band reaches ~24px and a tall prop's box up to ~50px — the
 * overlap is what keeps a seam invisible.
 */
const DEFAULT_PADDING = 48
const DEFAULT_MARGIN = 1
/** One band per update: a 640×96 strip of ground plus its bake is a calm frame. */
const DEFAULT_BAND_HEIGHT = 96
/**
 * A band paints this far past its own bake frame. Every element (fringe tufts,
 * tone ellipses, a scatter specimen) is drawn by whichever band's window owns its
 * anchor; with a margin, anything straddling a band seam is drawn by BOTH bands and
 * each bake keeps its own half — seams stay invisible. Without it the tallest
 * element gets sliced flat at the seam.
 */
const BAND_PAINT_MARGIN = 24
/** Rebuild work allowed per `update`. Two bands a frame still beats a frozen view. */
const DEFAULT_BUDGET_MS = 20

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`
}

export function chunkRect(cx: number, cy: number, size: number): Rect {
  return { x: cx * size, y: cy * size, width: size, height: size }
}

/**
 * The chunk cells a view needs, grown by `margin` cells and clamped to the grid.
 * Pure grid math — the manager uses it, and the tests pin it down.
 */
export function chunksForView(
  view: Rect,
  chunkSize: number,
  world: { readonly width: number; readonly height: number },
  margin = 0,
): ChunkCoord[] {
  const cols = Math.max(1, Math.ceil(world.width / chunkSize))
  const rows = Math.max(1, Math.ceil(world.height / chunkSize))
  const clampIndex = (value: number, max: number): number => Math.min(Math.max(value, 0), max - 1)
  const fromX = clampIndex(Math.floor(view.x / chunkSize) - margin, cols)
  const toX = clampIndex(Math.floor((view.x + view.width) / chunkSize) + margin, cols)
  const fromY = clampIndex(Math.floor(view.y / chunkSize) - margin, rows)
  const toY = clampIndex(Math.floor((view.y + view.height) / chunkSize) + margin, rows)

  const cells: ChunkCoord[] = []
  for (let cy = fromY; cy <= toY; cy++) {
    for (let cx = fromX; cx <= toX; cx++) cells.push({ cx, cy })
  }
  return cells
}

/** One baked band of a chunk: a ground + decor sprite pair, placed at its frame. */
interface BandSlice {
  readonly ground: Sprite
  readonly decor: Sprite
  readonly textures: readonly Texture[]
}

interface ChunkRecord {
  readonly slices: BandSlice[]
}

/** A chunk that is still being painted, band by band. */
interface ChunkTask {
  readonly key: string
  readonly frame: Rect
  readonly window: Rect
  readonly bands: number
  nextBand: number
  readonly progress: ChunkRecord
}

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= x || bottom <= y) return null
  return { x, y, width: right - x, height: bottom - y }
}

function inflate(rect: Rect, pad: number): Rect {
  return { x: rect.x - pad, y: rect.y - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
}

/**
 * Builds the chunked ground for one map. Nothing is painted up front: the first
 * `update(view)` starts the chunks around the view (nearest first), later frames
 * fill them in band by band, and chunks that leave the margin are destroyed
 * together with their textures.
 */
export function createChunkedGround(options: ChunkedGroundOptions): ChunkedGround {
  const size = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const padding = options.padding ?? DEFAULT_PADDING
  const margin = options.margin ?? DEFAULT_MARGIN
  const bandHeight = options.bandHeight ?? DEFAULT_BAND_HEIGHT
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS
  const worldRect: Rect = { x: 0, y: 0, width: options.world.width, height: options.world.height }

  const ground = new Container()
  const decor = new Container()
  const chunks = new Map<string, ChunkRecord>()
  const tasks = new Map<string, ChunkTask>()

  /** Paints and bakes the next band of one chunk. */
  const bakeBand = (task: ChunkTask): void => {
    const bandTop = task.frame.y + task.nextBand * bandHeight
    // The bake frame: this band's slice of the chunk.
    const bandFrame = intersect(task.frame, { x: task.frame.x, y: bandTop, width: task.frame.width, height: bandHeight })
    // The paint window: that slice grown past its edges, then clamped to the chunk's
    // own window (which already covers the chunk padding + the fringe reach).
    const paintWindow = intersect(task.window, inflate({ x: task.frame.x, y: bandTop, width: task.frame.width, height: bandHeight }, BAND_PAINT_MARGIN))

    if (paintWindow && bandFrame) {
      const tempGround = new Container()
      const tempDecor = new Graphics()
      options.paint(options.painter, tempGround, tempDecor, paintWindow)

      const rectangle = new Rectangle(bandFrame.x, bandFrame.y, bandFrame.width, bandFrame.height)
      const groundTexture = options.renderer.generateTexture({ target: tempGround, frame: rectangle, antialias: false })
      const decorTexture = options.renderer.generateTexture({ target: tempDecor, frame: rectangle, antialias: false })
      tempGround.destroy({ children: true })
      tempDecor.destroy()

      const groundSprite = new Sprite(groundTexture)
      groundSprite.position.set(bandFrame.x, bandFrame.y)
      const decorSprite = new Sprite(decorTexture)
      decorSprite.position.set(bandFrame.x, bandFrame.y)
      ground.addChild(groundSprite)
      decor.addChild(decorSprite)
      task.progress.slices.push({ ground: groundSprite, decor: decorSprite, textures: [groundTexture, decorTexture] })
    }

    task.nextBand += 1
  }

  const dropSlices = (record: ChunkRecord): void => {
    for (const slice of record.slices) {
      slice.ground.destroy()
      slice.decor.destroy()
      for (const texture of slice.textures) texture.destroy(true)
    }
    record.slices.length = 0
  }

  const dropChunk = (key: string): void => {
    const record = chunks.get(key)
    if (record) dropSlices(record)
    chunks.delete(key)
    tasks.delete(key)
  }

  const startTask = (cx: number, cy: number): ChunkTask | null => {
    const frame = intersect(chunkRect(cx, cy, size), worldRect)
    if (!frame) return null
    const task: ChunkTask = {
      key: chunkKey(cx, cy),
      frame,
      window: inflate(frame, padding),
      bands: Math.max(1, Math.ceil(frame.height / bandHeight)),
      nextBand: 0,
      progress: { slices: [] },
    }
    chunks.set(task.key, task.progress)
    tasks.set(task.key, task)
    return task
  }

  const update = (view: Rect): void => {
    const wanted = chunksForView(view, size, options.world, margin)
    const centerX = view.x + view.width / 2
    const centerY = view.y + view.height / 2

    const started = performance.now()
    while (performance.now() - started < budgetMs) {
      // An unfinished chunk first (the nearest one), so a chunk fills in fully
      // before the next is started — never a screen of half-drawn fields.
      let task: ChunkTask | null = null
      let bestDistance = Number.POSITIVE_INFINITY
      for (const candidate of tasks.values()) {
        const distance = Math.hypot(
          candidate.frame.x + candidate.frame.width / 2 - centerX,
          candidate.frame.y + candidate.frame.height / 2 - centerY,
        )
        if (distance < bestDistance) {
          bestDistance = distance
          task = candidate
        }
      }

      if (!task) {
        let nearest: ChunkCoord | null = null
        let nearestDistance = Number.POSITIVE_INFINITY
        for (const cell of wanted) {
          if (chunks.has(chunkKey(cell.cx, cell.cy))) continue
          const distance = Math.hypot(cell.cx * size + size / 2 - centerX, cell.cy * size + size / 2 - centerY)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearest = cell
          }
        }
        if (!nearest) break
        task = startTask(nearest.cx, nearest.cy)
        if (!task) break
      }

      bakeBand(task)
      if (task.nextBand >= task.bands) tasks.delete(task.key)
    }

    // Keep one ring more than we paint, so a slow drag never evicts a chunk it is
    // about to need again (repainting costs far more than holding the texture).
    const alive = new Set(chunksForView(view, size, options.world, margin + 1).map((cell) => chunkKey(cell.cx, cell.cy)))
    for (const key of [...chunks.keys()]) {
      if (!alive.has(key)) dropChunk(key)
    }
  }

  return {
    ground,
    decor,
    update,
    destroy: () => {
      for (const key of [...chunks.keys()]) dropChunk(key)
      ground.destroy()
      decor.destroy()
    },
  }
}
