/**
 * Pure contour geometry for the edge tiles — no rendering imports, so the
 * clipping/scaling maths and the clearing masks can be unit-tested directly.
 */
import { makeRandom } from '../random'
import { TILE_SIZE } from './terrain'
import type { ZoneRect } from '../zoneLayout'

export { TILE_SIZE } from './terrain'

/** Radial roughening of a clearing outline, in px (see `blobContour`). */
export const CONTOUR_JITTER = 7
/** Total outline wave allowed, as a fraction of the radius (see `blobContour`). */
export const CONTOUR_AMP = 0.085
/** …and in px, so a small pond is as irregular as a big clearing. */
export const CONTOUR_MIN_AMP = 12
/**
 * Ceiling for the wave, as a fraction of the radius. A floor expressed in px must
 * be clamped for tiny blobs, or a 70×44 pond would be 30% wobble.
 */
const CONTOUR_MAX_AMP = 0.22

/**
 * Contour shapes for the 4-corner edge tiles, in tile-local coordinates
 * (0..TILE_SIZE). Bit order of the mask: 1 = top-left, 2 = top-right,
 * 4 = bottom-right, 8 = bottom-left — each bit means "inside the clearing".
 * Cases 0 (all outside) and 15 (all inside) have no shape.
 *
 * The corner cuts reach ~13/16 of the tile so a tile-grid staircase gets a
 * visible chamfer instead of a 90° corner.
 */
export const EDGE_SHAPES: Record<number, readonly (readonly number[])[]> = {
  1: [[0, 0, 13, 0, 10, 2, 8, 4, 6, 6, 4, 8, 2, 10, 0, 13]],
  2: [[3, 0, 16, 0, 16, 13, 14, 10, 12, 8, 10, 6, 8, 4, 6, 2]],
  3: [[0, 0, 16, 0, 16, 8, 12, 10, 8, 7, 4, 10, 0, 8]],
  4: [[16, 16, 16, 3, 14, 6, 12, 8, 10, 10, 8, 12, 6, 14, 3, 16]],
  5: [
    [0, 0, 13, 0, 10, 2, 8, 4, 6, 6, 4, 8, 2, 10, 0, 13],
    [16, 16, 16, 3, 14, 6, 12, 8, 10, 10, 8, 12, 6, 14, 3, 16],
  ],
  6: [[16, 0, 16, 16, 8, 16, 6, 12, 9, 8, 6, 4, 8, 0]],
  7: [[0, 13, 0, 0, 16, 0, 16, 16, 3, 16, 1, 14]],
  8: [[0, 16, 0, 3, 2, 6, 4, 8, 6, 10, 8, 12, 10, 14, 13, 16]],
  9: [[0, 0, 8, 0, 10, 4, 7, 8, 10, 12, 8, 16, 0, 16]],
  10: [
    [3, 0, 16, 0, 16, 13, 14, 10, 12, 8, 10, 6, 8, 4, 6, 2],
    [0, 16, 0, 3, 2, 6, 4, 8, 6, 10, 8, 12, 10, 14, 13, 16],
  ],
  11: [[0, 0, 16, 0, 16, 3, 15, 6, 12, 9, 10, 11, 8, 13, 5, 16, 0, 16]],
  12: [[0, 16, 16, 16, 16, 8, 12, 6, 8, 9, 4, 6, 0, 8]],
  13: [[0, 0, 3, 0, 6, 1, 8, 3, 10, 5, 12, 7, 14, 9, 16, 12, 16, 16, 0, 16]],
  14: [[3, 0, 16, 0, 16, 16, 0, 16, 0, 3, 2, 2, 4, 1]],
}

/** Scales a polygon about a point, snapped to half pixels for crisp edges. */
export function scaleAboutCentroid(
  points: readonly number[],
  centroid: { x: number; y: number },
  factor: number,
): number[] {
  const scaled: number[] = []
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] ?? 0
    const y = points[i + 1] ?? 0
    scaled.push(
      Math.round((centroid.x + (x - centroid.x) * factor) * 2) / 2,
      Math.round((centroid.y + (y - centroid.y) * factor) * 2) / 2,
    )
  }
  return scaled
}

export function polygonCentroid(points: readonly number[]): { x: number; y: number } {
  let sx = 0
  let sy = 0
  let count = 0
  for (let i = 0; i < points.length; i += 2) {
    sx += points[i] ?? 0
    sy += points[i + 1] ?? 0
    count++
  }
  if (count === 0) return { x: 0, y: 0 }
  return { x: sx / count, y: sy / count }
}

/**
 * Clips a polygon to the tile rect with Sutherland–Hodgman, so every drawn
 * contour stays inside the 16×16 frame (anything outside would inflate the
 * generated texture and smear across the map).
 */
export function clipPolygonToTile(points: readonly number[]): number[] {
  const edges = [
    { keep: (x: number) => x >= 0, cut: cutX(0) },
    { keep: (x: number) => x <= TILE_SIZE, cut: cutX(TILE_SIZE) },
    { keep: (_x: number, y: number) => y >= 0, cut: cutY(0) },
    { keep: (_x: number, y: number) => y <= TILE_SIZE, cut: cutY(TILE_SIZE) },
  ]

  let output = [...points]
  for (const edge of edges) {
    if (output.length < 6) return []
    const input = output
    output = []
    for (let i = 0; i < input.length; i += 2) {
      const ax = input[i] ?? 0
      const ay = input[i + 1] ?? 0
      const bx = input[(i + 2) % input.length] ?? 0
      const by = input[(i + 3) % input.length] ?? 0
      const insideA = edge.keep(ax, ay)
      const insideB = edge.keep(bx, by)
      if (insideA && insideB) {
        output.push(bx, by)
      } else if (insideA) {
        output.push(...edge.cut(ax, ay, bx, by))
      } else if (insideB) {
        output.push(...edge.cut(ax, ay, bx, by), bx, by)
      }
    }
  }
  return output
}

const cutX =
  (value: number) =>
  (ax: number, ay: number, bx: number, by: number): number[] => {
    const span = bx - ax
    const t = Math.abs(span) < 0.0001 ? 0 : (value - ax) / span
    return [value, ay + (by - ay) * t]
  }

const cutY =
  (value: number) =>
  (ax: number, ay: number, bx: number, by: number): number[] => {
    const span = by - ay
    const t = Math.abs(span) < 0.0001 ? 0 : (value - ay) / span
    return [ax + (bx - ax) * t, value]
  }

/**
 * The outline of a clearing: an **amorphous** blob, roughened at the tile scale.
 *
 * Three layers, and each one is doing a different job:
 * 1. one freq-1 lobe (3–5%) pushes one whole side out — this is what stops the
 *    patch from reading as an oval at a glance;
 * 2. 2–3 further lobes at freq 3–6 (2–4% each) make the rest of the border swell
 *    and indent unevenly, so no two stretches look alike;
 * 3. a ±4px radial jitter on every sample (~7px apart) so the tile grid, which
 *    quantises the outline, cuts a **jagged one-tile edge** instead of a clean
 *    curve.
 *
 * The wave budget is normalised (between `CONTOUR_AMP` and a clamped
 * `CONTOUR_MIN_AMP` px floor) and the jitter is capped against the radius: a
 * percentage alone flattens small ponds into rounded rectangles, but a pixel floor
 * alone would wreck them. The jitter is what removes long straight runs — the tile
 * grid only stops cutting a flat edge if the outline moves ~a tile within a couple
 * of tiles of length, which needs a roughening on the scale of a tile, not 4px.
 */
export function blobContour(rect: ZoneRect, pad: number, seed: number): number[] {
  const rnd = makeRandom(seed * 17 + 3)
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const rx = rect.width / 2 + pad
  const ry = rect.height / 2 + pad

  // freq 1–2 push whole sides out (breaks the oval read), freq 3–6 dent the rest.
  const lobes: { freq: number; amp: number; phase: number }[] = [
    { freq: 1, amp: 0.03 + rnd() * 0.02, phase: rnd() * Math.PI * 2 },
    { freq: 2, amp: 0.03 + rnd() * 0.02, phase: rnd() * Math.PI * 2 },
  ]
  const freqs = [3, 4, 5, 6]
  const mediumCount = 2 + Math.floor(rnd() * 2)
  for (let i = 0; i < mediumCount; i++) {
    const freq = freqs.splice(Math.floor(rnd() * freqs.length), 1)[0] ?? 3
    lobes.push({ freq, amp: 0.02 + rnd() * 0.02, phase: rnd() * Math.PI * 2 })
  }
  const radius = (rx + ry) / 2
  const budget = Math.min(CONTOUR_MAX_AMP, Math.max(CONTOUR_AMP, CONTOUR_MIN_AMP / radius))
  const total = lobes.reduce((sum, lobe) => sum + lobe.amp, 0)
  if (total > budget) {
    const scale = budget / total
    for (const lobe of lobes) lobe.amp *= scale
  }
  const jitterAmount = Math.min(CONTOUR_JITTER, radius * 0.12)

  const count = 56
  const points: number[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    let wobble = 1
    for (const lobe of lobes) wobble += lobe.amp * Math.sin(lobe.freq * angle + lobe.phase)
    const baseX = cx + Math.cos(angle) * rx * wobble
    const baseY = cy + Math.sin(angle) * ry * wobble
    const dirX = baseX - cx
    const dirY = baseY - cy
    const length = Math.hypot(dirX, dirY) || 1
    const jitter = (rnd() * 2 - 1) * jitterAmount
    points.push(
      Math.round((baseX + (dirX / length) * jitter) * 4) / 4,
      Math.round((baseY + (dirY / length) * jitter) * 4) / 4,
    )
  }
  return points
}

/**
 * Straight band outline (a path), optionally flared at its ends.
 *
 * A band keeps one width for its whole length — a blob would taper to a point and
 * pinch the link. `flare` widens the mouth(s), `ramp` is how many px the widening
 * takes to fade back to the band width, and `mouths` picks which end flares: a
 * funnel only makes sense on the end that opens into an area, while a bell on the
 * end that meets a road is just an artificial trapezoid.
 */
export function rectContour(
  rect: ZoneRect,
  flare = 0,
  ramp = flare,
  mouths: 'both' | 'top' | 'bottom' = 'both',
): number[] {
  const { x, y, width, height } = rect
  const topFlare = flare > 0 && mouths !== 'bottom' ? flare : 0
  const bottomFlare = flare > 0 && mouths !== 'top' ? flare : 0
  if (topFlare === 0 && bottomFlare === 0) {
    return [x, y, x + width, y, x + width, y + height, x, y + height]
  }
  const length = Math.max(2, Math.min(ramp, height / 2 - 1))
  return [
    x - topFlare,
    y,
    x + width + topFlare,
    y,
    x + width,
    y + length,
    x + width,
    y + height - length,
    x + width + bottomFlare,
    y + height,
    x - bottomFlare,
    y + height,
    x,
    y + height - length,
    x,
    y + length,
  ]
}

export function pointInPolygon(x: number, y: number, points: readonly number[]): boolean {
  const count = points.length / 2
  let inside = false
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = points[i * 2] ?? 0
    const yi = points[i * 2 + 1] ?? 0
    const xj = points[j * 2] ?? 0
    const yj = points[j * 2 + 1] ?? 0
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Stable hash of a tile corner — neighbours agree, so contours never crack.
 *
 * Uses a proper avalanche mix (murmur3-style): a plain `imul` + one xorshift
 * leaves small sequential inputs nearly linear, which turns any value-noise
 * built on it into a flat plane (that bug made the ground a checkerboard).
 */
export function cornerHash(x: number, y: number, seed: number): number {
  const base =
    (Math.imul(Math.round(x) | 0, 0x27d4eb2d) ^
      Math.imul(Math.round(y) | 0, 0x85ebca6b) ^
      Math.imul(seed | 0, 0xc2b2ae35)) |
    0
  return mix32(base)
}

function mix32(value: number): number {
  let h = value | 0
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return h >>> 0
}

/**
 * Is a tile corner inside the clearing? Jittered by ±3px, shared by neighbours
 * so the outline stays continuous while the rendered contour keeps stepping in
 * and out instead of running straight. Bigger jitter than this out-steps the
 * tile grid and the edge reads as square blocks.
 */
export function insideCorner(x: number, y: number, points: readonly number[], seed: number): boolean {
  const jitterX = (cornerHash(x, y, seed) % 7) - 3
  const jitterY = (cornerHash(x + 1013, y + 7919, seed) % 7) - 3
  return pointInPolygon(x + jitterX, y + jitterY, points)
}

/** 4-corner mask of a tile: 1 = TL, 2 = TR, 4 = BR, 8 = BL (bit set = inside). */
export function cornerMask(x: number, y: number, points: readonly number[], seed: number): number {
  return (
    (insideCorner(x, y, points, seed) ? 1 : 0) |
    (insideCorner(x + TILE_SIZE, y, points, seed) ? 2 : 0) |
    (insideCorner(x + TILE_SIZE, y + TILE_SIZE, points, seed) ? 4 : 0) |
    (insideCorner(x, y + TILE_SIZE, points, seed) ? 8 : 0)
  )
}

export interface CliffBand {
  x1: number
  y1: number
  x2: number
  y2: number
  /** How far the wall face drops below the edge, in px. */
  depth: number
}

/**
 * Picks the contour edges a raised plateau shows a wall on. The sun sits up-left
 * and the camera looks from the south, so south-facing edges get the full wall,
 * east-facing ones a thinner wall, and north/west edges are hidden behind the
 * plateau itself (only their crest stays visible).
 *
 * Shapes are wound clockwise in screen space, so the outward normal of an edge
 * (dx, dy) is (dy, -dx) / length.
 */
export function cliffBandEdges(
  points: readonly number[],
  faceDepth = 6,
  sideDepth = 4,
): CliffBand[] {
  const bands: CliffBand[] = []
  const count = points.length / 2
  for (let i = 0; i < count; i++) {
    const x1 = points[i * 2] ?? 0
    const y1 = points[i * 2 + 1] ?? 0
    const x2 = points[((i + 1) % count) * 2] ?? 0
    const y2 = points[((i + 1) % count) * 2 + 1] ?? 0
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.hypot(dx, dy)
    if (length < 0.5) continue
    const nx = dy / length
    const ny = -dx / length
    if (ny > 0.35) bands.push({ x1, y1, x2, y2, depth: faceDepth })
    else if (nx > 0.45) bands.push({ x1, y1, x2, y2, depth: sideDepth })
  }
  return bands
}

/** Shortest distance from a point to a closed contour (used for cliff tails). */
export function distanceToContour(points: readonly number[], x: number, y: number): number {
  const count = points.length / 2
  if (count < 3) return Number.POSITIVE_INFINITY
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < count; i++) {
    const ax = points[i * 2] ?? 0
    const ay = points[i * 2 + 1] ?? 0
    const bx = points[((i + 1) % count) * 2] ?? 0
    const by = points[((i + 1) % count) * 2 + 1] ?? 0
    best = Math.min(best, distanceToSegment(x, y, ax, ay, bx, by))
  }
  return best
}

export function distanceToSegment(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq))
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t))
}