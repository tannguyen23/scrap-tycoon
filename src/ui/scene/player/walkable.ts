import { pointInPolygon } from '@ground/core/edgeGeometry'
import type { Rect } from '@ground/core/metrics'
import { DECOR_PLACEMENTS } from '@ground/packs/scrapYard/decorPlacements'
import { SOLID_DECOR } from '@ground/packs/scrapYard/decorItems'
import {
  CLEARINGS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
  type FenceOpening,
} from '@ground/packs/scrapYard/worldLayout'
import { scrapWaterBodies } from '../waterBodies'

/**
 * What a walker can stand on, derived from the world data the map is painted
 * from — no second map, no pathfinding. Three kinds of "no":
 *
 *   • **fences**: a painted zone fence is a line on its rect edge, crossable only
 *     at a declared `fenceOpenings` gate (zones without gates are unfenced, like
 *     the avenue band);
 *   • **water**: the exact painted waterline (`blobContour`, same rect/pad/seed),
 *     so a step can never land on ground the map drew as pond;
 *   • **props**: raised clearings (their edges are walls) and the BASE of every
 *     `solid` decor specimen — only the base blocks, so a canopy overhangs.
 *
 * Everything here is pure so `tests/walkable.test.ts` can walk the real map.
 */

export interface Spot {
  x: number
  y: number
}

interface FenceBand {
  readonly rect: Rect
  readonly openings: readonly FenceOpening[]
}

export interface Blockers {
  /** Raised clearings and prop bases. */
  readonly rects: readonly Rect[]
  /** Pond/lake outlines. */
  readonly polys: readonly (readonly number[])[]
  readonly fences: readonly FenceBand[]
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

/** Is (x, y) on a fenced edge, and if so which one. */
function fenceEdge(rect: Rect, x: number, y: number): FenceOpening['edge'] | null {
  if (x < rect.x - FENCE_HALF || x > rect.x + rect.width + FENCE_HALF) return null
  if (y < rect.y - FENCE_HALF || y > rect.y + rect.height + FENCE_HALF) return null
  if (Math.abs(y - rect.y) <= FENCE_HALF) return 'north'
  if (Math.abs(y - (rect.y + rect.height)) <= FENCE_HALF) return 'south'
  if (Math.abs(x - rect.x) <= FENCE_HALF) return 'west'
  if (Math.abs(x - (rect.x + rect.width)) <= FENCE_HALF) return 'east'
  return null
}

/** True when the fence line at (x, y) is closed — a gate opening lets you through. */
function fenceBlocks(band: FenceBand, x: number, y: number): boolean {
  const edge = fenceEdge(band.rect, x, y)
  if (!edge) return false
  const along =
    edge === 'north' || edge === 'south' ? x - band.rect.x : y - band.rect.y
  return !band.openings.some((opening) => opening.edge === edge && along >= opening.from && along <= opening.to)
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

  const fences: FenceBand[] = []
  for (const layout of Object.values(ZONE_LAYOUTS)) {
    const openings = layout.fenceOpenings
    // An unfenced zone (the avenue band) has no gate list at all.
    if (!openings || openings.length === 0) continue
    fences.push({ rect: layout.rect, openings })
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
  for (const band of blockers.fences) {
    if (fenceBlocks(band, x, y)) return false
  }
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
