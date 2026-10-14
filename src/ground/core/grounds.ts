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
  /** Hand-placed decor, drawn last. */
  readonly decor?: (decor: Graphics) => void
}

/** No-go rects of the random scatter: the floor blobs plus the map's extras. */
export function scatterSkipRects(map: GroundMap): Rect[] {
  return [...map.floors.map((floor) => inflate(floor.rect, floor.pad)), ...(map.scatterSkip ?? [])]
}

/** Paints a map with a pack — the whole composition, in the kit's fixed order. */
export function paintGrounds(
  pack: GroundPack,
  map: GroundMap,
  painter: TilePainter,
  ground: Container,
  decor: Graphics,
): void {
  const world: Rect = { x: 0, y: 0, width: map.width, height: map.height }
  painter.paint(ground, world, map.base, map.baseSeed)
  painter.patchwork(ground, world, map.patchworkSeed)
  const skip = scatterSkipRects(map)
  painter.scatter(ground, world, map.floraSeed, 'flora', 22, skip)

  for (const lane of map.lanes) paintCall(painter, ground, lane, map.base)
  for (const floor of map.floors) {
    painter.paintBlob(ground, floor.rect, floor.kind, floor.seed, floor.pad, map.base)
  }
  for (const patch of map.clearings) {
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
  for (const trace of map.traces) {
    const options = { seed: trace.seed, strength: trace.strength }
    if (trace.kind === 'wear') pack.decals.wear(traces, trace.points, options)
    else if (trace.kind === 'footprints') pack.decals.footprints(traces, trace.points, options)
    else if (trace.kind === 'ruts') pack.decals.ruts(traces, trace.points, options)
    else pack.decals.dragMarks(traces, trace.points, options)
  }
  ground.addChild(traces)

  map.connectors.rects.forEach((rect, index) => {
    painter.paint(ground, rect, map.connectors.kind, map.connectors.seedBase + index)
  })
  for (const link of map.links) paintCall(painter, ground, link, map.base)

  painter.scatter(ground, world, map.debrisSeed, 'debris', 22, skip)
  // Water last among the blobs so debris never lands on a water surface.
  for (const area of map.water) {
    painter.paintBlob(
      ground,
      area.rect,
      area.kind ?? map.base,
      area.seed,
      area.pad ?? 10,
      area.outside ?? map.base,
      area.elevation ?? 0,
    )
  }
  map.decor?.(decor)
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
