import { Graphics, type Container } from 'pixi.js'
import type { GroundCanvas, Point } from './groundCanvas'
import type { GroundPack } from './pack'
import type { TerrainId } from './terrain'
import type { Rect } from './metrics'
import type { TilePainter } from './painter'

export interface FloorCall {
  readonly rect: Rect
  readonly kind: TerrainId
  readonly seed: number
  readonly pad: number
}

export interface BlobCall {
  readonly rect: Rect
  readonly seed: number
  readonly kind?: TerrainId
  readonly outside?: TerrainId
  readonly elevation?: number
  readonly pad?: number
}

/**
 * Pad a blob grows past its rect when nothing else is declared. Shared so anyone
 * recomputing a blob's contour (the scene kit's water layer, the seam lab) derives
 * the very same waterline the map painted.
 */
export const DEFAULT_BLOB_PAD = 10

export interface PathCall {
  readonly rect: Rect
  readonly kind: TerrainId
  readonly seed: number
  readonly outside?: TerrainId
  readonly flare?: number
  readonly ramp?: number
  readonly mouths?: 'both' | 'top' | 'bottom'
  readonly jitter?: number
}

export type TraceKind = 'wear' | 'footprints' | 'ruts' | 'dragMarks'

export interface TraceCall {
  readonly kind: TraceKind
  readonly points: readonly Point[]
  readonly seed: number
  readonly strength: number
}

/**
 * One project's ground plan, as data: what gets painted, where and with which
 * seed, in an order the kit owns. The kit's `paintGrounds` runs the passes in
 * the order the comments in the scrap map explain — base → texture scatter →
 * lanes (their mouths tuck under the floors) → floors → clearings → usage
 * traces → connectors → links → debris → water → hand-placed decor.
 */
export interface GroundMap {
  readonly width: number
  readonly height: number
  readonly base: TerrainId
  readonly baseSeed: number
  readonly patchworkSeed: number
  readonly floraSeed: number
  readonly lanes: readonly PathCall[]
  readonly floors: readonly FloorCall[]
  readonly clearings: readonly BlobCall[]
  readonly traces: readonly TraceCall[]
  readonly connectors: {
    readonly rects: readonly Rect[]
    readonly kind: TerrainId
    readonly seedBase: number
  }
  readonly links: readonly PathCall[]
  readonly debrisSeed: number
  readonly water: readonly BlobCall[]
  /** Extra no-go rects for the random scatter (e.g. a road band). */
  readonly scatterSkip?: readonly Rect[]
  /**
   * Hand-placed decor, drawn last. `window` (chunk painting) is the rect being
   * painted — a map with hundreds of props must skip the ones outside it, or every
   * chunk pays for the whole world's decor.
   */
  readonly decor?: (decor: Graphics, window?: Rect) => void
}

/** No-go rects of the random scatter: the floor blobs plus the map's extras. */
export function scatterSkipRects(map: GroundMap): Rect[] {
  return [...map.floors.map((floor) => inflate(floor.rect, floor.pad)), ...(map.scatterSkip ?? [])]
}

/**
 * A map call's reach past its own rect: pads, flares and the fringe/decoration
 * band all draw outside the declared box, and a window that merely touches the
 * box still has to catch them.
 */
const CALL_MARGIN = 72

/**
 * Which map calls a window (a chunk) actually needs, with the connector seeds
 * preserved (a connector's seed is its index in the map, so filtering must not
 * renumber it). Pure, so the chunk plan is testable without a renderer.
 */
export interface PlannedChunkCalls {
  readonly base: Rect
  readonly lanes: readonly PathCall[]
  readonly floors: readonly FloorCall[]
  readonly clearings: readonly BlobCall[]
  readonly traces: readonly TraceCall[]
  readonly connectors: readonly { readonly rect: Rect; readonly seed: number }[]
  readonly links: readonly PathCall[]
  readonly water: readonly BlobCall[]
}

export function planChunkCalls(map: GroundMap, window?: Rect): PlannedChunkCalls {
  const connectors = map.connectors.rects.map((rect, index) => ({ rect, seed: map.connectors.seedBase + index }))
  const world: Rect = { x: 0, y: 0, width: map.width, height: map.height }
  if (!window) {
    return {
      base: world,
      lanes: map.lanes,
      floors: map.floors,
      clearings: map.clearings,
      traces: map.traces,
      connectors,
      links: map.links,
      water: map.water,
    }
  }

  const area = intersectRect(world, window) ?? { x: window.x, y: window.y, width: 0, height: 0 }
  const near = (rect: Rect, pad: number): boolean => intersectRect(area, inflate(rect, pad)) !== null
  return {
    base: area,
    lanes: map.lanes.filter((call) => near(call.rect, (call.flare ?? 0) + (call.ramp ?? call.flare ?? 0) + CALL_MARGIN)),
    floors: map.floors.filter((floor) => near(floor.rect, floor.pad + CALL_MARGIN)),
    clearings: map.clearings.filter((patch) => near(patch.rect, (patch.pad ?? 16) + CALL_MARGIN)),
    traces: map.traces.filter((trace) => near(boundsOf(trace.points), CALL_MARGIN)),
    connectors: connectors.filter((entry) => near(entry.rect, CALL_MARGIN)),
    links: map.links.filter((call) => near(call.rect, (call.flare ?? 0) + (call.ramp ?? call.flare ?? 0) + CALL_MARGIN)),
    water: map.water.filter((area) => near(area.rect, (area.pad ?? DEFAULT_BLOB_PAD) + CALL_MARGIN)),
  }
}

/**
 * Paints a map with a pack — the whole composition, in the kit's fixed order.
 *
 * `window` (chunk painting) restricts every pass to a rect: the painter culls its
 * loops to it, and calls that reach outside the window are skipped. Geometry is
 * **position-anchored**, so a chunk painted on its own carries the very same
 * tiles, scatter cells and dressing as the full-map pass — chunks can overlap,
 * be evicted and be repainted without ever drifting.
 */
export function paintGrounds(
  pack: GroundPack,
  map: GroundMap,
  painter: TilePainter,
  ground: Container,
  decor: Graphics,
  window?: Rect,
): void {
  const plan = planChunkCalls(map, window)
  painter.setClip(window ?? null)
  try {
    painter.paint(ground, plan.base, map.base, map.baseSeed)
    painter.patchwork(ground, plan.base, map.patchworkSeed)
    const skip = scatterSkipRects(map)
    painter.scatter(ground, plan.base, map.floraSeed, 'flora', 22, skip)

    for (const lane of plan.lanes) paintCall(painter, ground, lane, map.base)
    for (const floor of plan.floors) {
      painter.paintBlob(ground, floor.rect, floor.kind, floor.seed, floor.pad, map.base)
    }
    for (const patch of plan.clearings) {
      painter.paintBlob(
        ground,
        patch.rect,
        patch.kind ?? map.base,
        patch.seed,
        patch.pad ?? 16,
        patch.outside ?? map.base,
        patch.elevation ?? 0,
      )
    }

    const traces = new Graphics()
    for (const trace of plan.traces) {
      const options = { seed: trace.seed, strength: trace.strength }
      if (trace.kind === 'wear') pack.decals.wear(traces, trace.points, options)
      else if (trace.kind === 'footprints') pack.decals.footprints(traces, trace.points, options)
      else if (trace.kind === 'ruts') pack.decals.ruts(traces, trace.points, options)
      else pack.decals.dragMarks(traces, trace.points, options)
    }
    ground.addChild(traces)

    for (const connector of plan.connectors) {
      painter.paint(ground, connector.rect, map.connectors.kind, connector.seed)
    }
    for (const link of plan.links) paintCall(painter, ground, link, map.base)

    painter.scatter(ground, plan.base, map.debrisSeed, 'debris', 22, skip)
    // Water last among the blobs so debris never lands on a water surface.
    for (const area of plan.water) {
      painter.paintBlob(
        ground,
        area.rect,
        area.kind ?? map.base,
        area.seed,
        area.pad ?? DEFAULT_BLOB_PAD,
        area.outside ?? map.base,
        area.elevation ?? 0,
      )
    }
    map.decor?.(decor, window)
  } finally {
    painter.setClip(null)
  }
}

function boundsOf(points: readonly Point[]): Rect {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }
  if (minX > maxX || minY > maxY) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= x || bottom <= y) return null
  return { x, y, width: right - x, height: bottom - y }
}

function paintCall(painter: TilePainter, ground: Container, call: PathCall, base: TerrainId): void {
  painter.paintPath(
    ground,
    call.rect,
    call.kind,
    call.seed,
    call.outside ?? base,
    call.flare ?? 0,
    call.ramp ?? call.flare ?? 0,
    call.mouths ?? 'both',
    call.jitter ?? 0,
  )
}

function inflate(rect: Rect, pad: number): Rect {
  return { x: rect.x - pad, y: rect.y - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
}

/** Boot-time map checks: every terrain it names must exist in the pack. */
export function validateGroundMap(pack: GroundPack, map: GroundMap): string[] {
  const errors: string[] = []
  const known = new Set(pack.terrains.map((terrain) => terrain.id))
  const check = (kind: TerrainId | undefined, where: string): void => {
    if (kind !== undefined && !known.has(kind)) errors.push(`${where} uses unknown terrain "${kind}"`)
  }
  const insideWorld = (rect: Rect, where: string): void => {
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > map.width || rect.y + rect.height > map.height) {
      errors.push(`${where} sticks out of the map`)
    }
  }
  check(map.base, 'map base')
  check(map.connectors.kind, 'connectors')
  map.lanes.forEach((call, index) => {
    check(call.kind, `lane ${index}`)
    check(call.outside, `lane ${index} outside`)
    insideWorld(call.rect, `lane ${index}`)
  })
  map.links.forEach((call, index) => {
    check(call.kind, `link ${index}`)
    check(call.outside, `link ${index} outside`)
    insideWorld(call.rect, `link ${index}`)
  })
  map.floors.forEach((floor, index) => {
    check(floor.kind, `floor ${index}`)
    insideWorld(floor.rect, `floor ${index}`)
  })
  map.clearings.forEach((patch, index) => {
    check(patch.kind, `clearing ${index}`)
    check(patch.outside, `clearing ${index} outside`)
    insideWorld(patch.rect, `clearing ${index}`)
  })
  map.water.forEach((area, index) => {
    check(area.kind, `water ${index}`)
    check(area.outside, `water ${index} outside`)
    insideWorld(area.rect, `water ${index}`)
  })
  map.connectors.rects.forEach((rect, index) => insideWorld(rect, `connector ${index}`))
  return errors
}

export type { GroundCanvas, Point }
