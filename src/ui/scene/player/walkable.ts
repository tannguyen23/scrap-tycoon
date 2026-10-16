import { distanceToSegment, pointInPolygon } from '@ground/core/edgeGeometry'
import type { Rect } from '@ground/core/metrics'
import { DECOR_PLACEMENTS } from '@ground/packs/scrapYard/decorPlacements'
import { SOLID_DECOR } from '@ground/packs/scrapYard/decorItems'
import {
  CLEARINGS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
  zoneFenceRuns,
  type FenceRun,
} from '@ground/packs/scrapYard/worldLayout'
import { ALLEY_PROPS } from '../focus/alley/scene'
import { APPLIANCES_PROPS } from '../focus/appliances/scene'
import { DEPOT_PROPS } from '../focus/depot/scene'
import { GATE_PROPS } from '../focus/gate/scene'
import { propBase, type ZoneProp } from '../focus/props'
import { RECYCLE_PROPS } from '../focus/recycle/scene'
import { ROUTE_PROPS } from '../focus/route/scene'
import { TIRES_PROPS } from '../focus/tires/scene'
import { scrapWaterBodies } from '../waterBodies'

/** Vật đứng của từng khu (toạ độ LOCAL) — đúng danh sách mà scene khu vẽ ra. */
const ZONE_PROPS: Record<string, readonly ZoneProp[]> = {
  alley: ALLEY_PROPS,
  tires: TIRES_PROPS,
  appliances: APPLIANCES_PROPS,
  recycle: RECYCLE_PROPS,
  depot: DEPOT_PROPS,
  gate: GATE_PROPS,
  route: ROUTE_PROPS,
}

/**
 * What a walker can stand on, derived from the world data the map is painted
 * from — no second map, no pathfinding. Three kinds of "no":
 *
 *   • **fences**: the painted fence of every zone and of every pen inside it,
 *     which is a list of straight runs with the gates already cut out of them —
 *     the same runs the art draws, so what you see is what blocks;
 *   • **water**: the exact painted waterline (`blobContour`, same rect/pad/seed),
 *     so a step can never land on ground the map drew as pond;
 *   • **props**: raised clearings (their edges are walls), the BASE of every `solid`
 *     decor specimen on the map, and the BASE of every standing prop a zone scene
 *     draws (`ZONE_PROPS`) — only the base blocks, so a canopy or a heap's top
 *     overhangs the path. Flat things are never declared: you step over them.
 *
 * Everything here is pure so `tests/walkable.test.ts` can walk the real map.
 */

export interface Spot {
  x: number
  y: number
}

export interface Blockers {
  /** Raised clearings and prop bases. */
  readonly rects: readonly Rect[]
  /** Pond/lake outlines. */
  readonly polys: readonly (readonly number[])[]
  /** Fence runs, world space — gates are gaps between runs, not something you test for. */
  readonly fences: readonly FenceRun[]
}

/**
 * Half-thickness of the fence line, px. A fence is a *line*, so it is tested at
 * the walker's centre (a body may lean over it) — but the line is thick enough
 * that a step cannot jump it, and `slideMove` sub-steps long moves besides.
 */
export const FENCE_HALF = 3
/** Longest move applied in one collision test, px — no tunnelling through a fence. */
const MAX_SUBSTEP = 3
/**
 * A raised clearing's painted contour reaches past its rect by its pad (16) plus
 * the contour jitter; blocking a little beyond that keeps a walker off the wall.
 */
const PLATEAU_MARGIN = 20
/** Share of a prop's declared width that blocks at its base. */
const BASE_WIDTH_SHARE = 0.45
/** Tallest base box a prop gets, px — above this the rest overhangs the path. */
const BASE_MAX_HEIGHT = 18
/** How far below its anchor a prop's base box extends, px (contact shadow). */
const BASE_FOOT = 4
/** Walker half-size, px — the sprite stands ~11px wide. */
export const WALKER_RADIUS = 4

const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const

/** The base box of a solid prop: its trunk/footprint, not its whole silhouette. */
export function solidBox(specimen: { width: number; height: number }, x: number, y: number): Rect {
  const half = Math.max(3, specimen.width * BASE_WIDTH_SHARE * 0.5)
  const height = Math.min(BASE_MAX_HEIGHT, Math.max(6, specimen.height))
  return { x: x - half, y: y - height, width: half * 2, height: height + BASE_FOOT }
}

/** Is (x, y) on a fence run? Gates are gaps in the run list, so they never hit. */
function fenceBlocks(fences: readonly FenceRun[], x: number, y: number): boolean {
  for (const run of fences) {
    if (distanceToSegment(x, y, run.x1, run.y1, run.x2, run.y2) <= FENCE_HALF) return true
  }
  return false
}

/**
 * Nothing is derived twice: fences come from the same `ZONE_LAYOUTS` the zone
 * scenes draw, water from the same blob calls the ground pass paints, and props
 * from the placements themselves.
 */
export function buildBlockers(): Blockers {
  const rects: Rect[] = []

  for (const patch of CLEARINGS) {
    if ((patch.elevation ?? 0) <= 0) continue
    rects.push({
      x: patch.rect.x - PLATEAU_MARGIN,
      y: patch.rect.y - PLATEAU_MARGIN,
      width: patch.rect.width + PLATEAU_MARGIN * 2,
      height: patch.rect.height + PLATEAU_MARGIN * 2,
    })
  }

  for (const placement of DECOR_PLACEMENTS) {
    const specimen = SOLID_DECOR.get(placement.key)
    if (!specimen) continue
    rects.push(solidBox(specimen, placement.x, placement.y))
  }

  // Props standing inside a yard block at their base, exactly the way map decor does
  // (same base-box numbers). The list is the one the zone scene DRAWS from, so art and
  // collision cannot drift; flat things (lying tyres, pallets, bags, bottles, weeds)
  // are not declared at all — you step over them on purpose.
  for (const [zoneId, layout] of Object.entries(ZONE_LAYOUTS)) {
    for (const prop of ZONE_PROPS[zoneId] ?? []) {
      const base = propBase(prop)
      rects.push({
        x: layout.rect.x + base.x,
        y: layout.rect.y + base.y,
        width: base.width,
        height: base.height + BASE_FOOT,
      })
    }
  }

  // Fences come from the layout: every zone that declares a ring (`outline` + gates)
  // or a rect fence (`fenceOpenings`) gets its runs — the very ones the scene draws.
  const fences: FenceRun[] = []
  for (const layout of Object.values(ZONE_LAYOUTS)) {
    const fenced = (layout.outline?.length ?? 0) >= 3 || (layout.fenceOpenings?.length ?? 0) > 0
    if (fenced) fences.push(...zoneFenceRuns(layout))
  }

  return {
    rects,
    polys: scrapWaterBodies().map((body) => body.contour),
    fences,
  }
}

/** Can a walker of `radius` stand centred on (x, y)? */
export function canStand(blockers: Blockers, x: number, y: number, radius = WALKER_RADIUS): boolean {
  if (x < radius || y < radius || x > WORLD_WIDTH - radius || y > WORLD_HEIGHT - radius) return false
  // Fences: a line, so the centre is what may not cross it.
  if (fenceBlocks(blockers.fences, x, y)) return false
  // Solid volumes: every corner of the body has to fit.
  for (const [sx, sy] of CORNERS) {
    const px = x + sx * radius
    const py = y + sy * radius
    for (const rect of blockers.rects) {
      if (px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height) return false
    }
    for (const poly of blockers.polys) {
      if (pointInPolygon(px, py, poly)) return false
    }
  }
  return true
}

/**
 * Moves from `from` by (dx, dy), sliding along whatever it hits: the full step
 * first, then each axis alone. Long moves are applied in sub-steps so a fast
 * sprint can never tunnel through a fence.
 *
 * Deliberately not a pathfinder — the world is open ground with fences, ponds and
 * props, so sliding is all a walker needs.
 */
export function slideMove(
  blockers: Blockers,
  from: Spot,
  dx: number,
  dy: number,
  radius = WALKER_RADIUS,
): Spot {
  const clampX = (value: number): number => Math.min(Math.max(value, radius), WORLD_WIDTH - radius)
  const clampY = (value: number): number => Math.min(Math.max(value, radius), WORLD_HEIGHT - radius)

  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_SUBSTEP))
  const stepX = dx / steps
  const stepY = dy / steps
  let x = from.x
  let y = from.y

  for (let step = 0; step < steps; step++) {
    const full = { x: clampX(x + stepX), y: clampY(y + stepY) }
    if (canStand(blockers, full.x, full.y, radius)) {
      x = full.x
      y = full.y
      continue
    }
    if (stepX !== 0) {
      const slideX = clampX(x + stepX)
      if (canStand(blockers, slideX, y, radius)) x = slideX
    }
    if (stepY !== 0) {
      const slideY = clampY(y + stepY)
      if (canStand(blockers, x, slideY, radius)) y = slideY
    }
  }
  return { x, y }
}

/** Zone whose rect contains (x, y) — the yard a job can be done in. */
export function zoneAt(x: number, y: number): string | null {
  for (const [id, layout] of Object.entries(ZONE_LAYOUTS)) {
    const { rect } = layout
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return id
  }
  return null
}
