import { cornerHash } from '@ground/core/edgeGeometry'
import { Container, Graphics } from 'pixi.js'
import type { SceneWind } from '@scenery/core/ambience'
import type { SceneServices } from './services'
import type { Spot } from './types'

/**
 * A still body of water the scene keeps alive: its waterline, in world space.
 *
 * The contour is the pond's own (`blobContour`), so a swell can never break on
 * the bank — every crest is clipped to the pond's chord at its own row.
 */
export interface WaterBody {
  readonly center: Spot
  /** Waterline as flat x,y pairs. */
  readonly contour: readonly number[]
}

export interface WaterLayer {
  readonly bodies: readonly WaterBody[]
  /**
   * Crest tone. It has to be a tone **of this water** — the pack's base blended
   * part-way toward its own highlight. The raw highlight reads as a white bar
   * across the pond, and a colour invented from scratch disappears into it.
   */
  readonly crest: number
  /** Fish silhouette — the water's own **shade**, so a fish reads as under it. */
  readonly fish: number
}

export interface WaterLife {
  readonly container: Container
  /** `wind` drives the swell and hurries the sets along. */
  update(dt: number, wind: SceneWind): void
}

/** One crest line, sloshing between the two shores. */
interface Crest {
  readonly node: Graphics
  readonly body: WaterBody
  /** The body's vertical extent: the two shores it bounces off. */
  readonly range: { readonly min: number; readonly max: number }
  /** The body's set phase, so ponds never pump in unison. */
  readonly phase: number
  readonly shape: number
  readonly salt: number
  /** Mirrored when the swell reflects off a shore. */
  slope: number
  dir: 1 | -1
  /** Fractional row; the node is drawn on its rounded value. */
  row: number
  drawnRow: number
}

/** One fish, swimming between random points that are always inside the water. */
interface Fish {
  readonly node: Container
  readonly tailIn: Graphics
  readonly tailOut: Graphics
  readonly body: WaterBody
  x: number
  y: number
  targetX: number
  targetY: number
  readonly speed: number
  readonly phase: number
}

/** Crests per pond — a train, so the swells arrive one after another. */
const CREST_COUNT = 3
/** px/s the crest travels between the shores. */
const CREST_SPEED = 15
const WRAP_MARGIN = 3

/**
 * Fish, deliberately sparse: a pond should not read as an aquarium. One per
 * ~2600px² of water, and small ones still get a couple.
 */
const FISH_AREA = 2600
const FISH_MIN = 1
const FISH_MAX = 4
const FISH_SPEED = { min: 6, max: 13 } as const
/** Under the surface, so only a silhouette shows. */
const FISH_ALPHA = 0.5
/** Tail beats per second. */
const FISH_TAIL_HZ = 5

/** Seconds for one swell set. Waves arrive in groups, not as one endless roll. */
const SET_PERIOD = 9
/** Floor of the set swing: the water never goes completely dead between sets. */
const SET_MIN = 0.34

/** Crest body: the lit line, plus a softer one under it on the biggest swells. */
const FACE_ALPHA = 0.45
const FACE_LENGTH = 0.82

/** Dash slots along the chord. The gaps are what make it broken water, not a ruler. */
const DASH_SLOTS = 9
const DASH_FILL = 0.58

/**
 * The crest is not a ruler: it rises and dips along its length. Amplitude in
 * whole pixels and a wavelength long enough that neighbouring dashes stay within
 * a pixel of each other — a bigger or shorter wave reads as a zigzag, not water.
 */
const WAVE_AMP = 2
const WAVE_LENGTH = 56

/**
 * How far a crest may be tilted, as a slope on x. A level line reads as a ruler
 * laid on the pond; real crests run diagonally, and each one leans its own way.
 */
const CREST_SLOPE = 0.22

/**
 * Vertical offset of a crest at `x`. Smooth by construction: this is the shape of
 * the swell, and `shape` phase-shifts it so no two crests undulate together.
 */
export function crestLift(x: number, shape: number): number {
  return Math.round(WAVE_AMP * Math.sin(x / WAVE_LENGTH + shape))
}

/** The shape of one crest, independent of where it currently is. */
export interface CrestPlan {
  readonly shape: number
  readonly slope: number
  readonly salt: number
}

/**
 * The dashes of one crest at one row, **already clipped to the water**: a slanted
 * crest walks off the shore long before its nominal row does, so every dash is
 * checked against the water at its own row. Pure, so the geometry the renderer
 * uses is the geometry the tests check.
 */
export function crestDashes(
  body: WaterBody,
  row: number,
  plan: CrestPlan,
): { x: number; y: number; length: number }[] {
  const spans = chordsAt(body.contour, row)
  const total = spans.reduce((sum, span) => sum + (span.x1 - span.x0), 0)
  if (total < 6) return []

  const dashes: { x: number; y: number; length: number }[] = []
  let slotIndex = 0
  for (const span of spans) {
    const width = span.x1 - span.x0
    // Dash slots follow each stretch's share of the row, so a narrow bay keeps its
    // own little crest instead of being swallowed by the wide part.
    const slots = Math.max(1, Math.round((DASH_SLOTS * width) / total))
    const dash = Math.max(2, Math.round((width * DASH_FILL) / slots))

    for (let slot = 0; slot < slots; slot++) {
      const x = span.x0 + Math.round((width * slot) / slots) + 1
      const length = Math.min(dash, span.x1 - x - 1)
      slotIndex++
      if (length < 2) continue

      // Tilt about the body's centre, then the swell's own shape, then one pixel of
      // break-up so the dashes are water rather than a printed line.
      const y =
        row +
        Math.round(plan.slope * (x - body.center.x)) +
        crestLift(x, plan.shape) +
        (cornerHash(slotIndex, row, plan.salt) % 2)

      const onWater = chordsAt(body.contour, y).some((s) => s.x0 <= x && s.x1 >= x + length)
      if (onWater) dashes.push({ x, y, length })
    }
  }
  return dashes
}

/**
 * Swing of the swell sets. Big waves come in groups: `sin` gives the long build
 * and release, and the floor keeps a little motion in between.
 */
export function swellStrength(setPhase: number): number {
  const wave = Math.max(0, Math.sin(setPhase))
  return SET_MIN + (1 - SET_MIN) * Math.pow(wave, 1.2)
}

/**
 * Every horizontal stretch of water at row `y`, in whole pixels. A radial contour
 * can cross one row several times, so this returns *all* inside intervals — taking
 * just the outermost pair would let a crest draw straight across a dry notch.
 * Exact scanline, even-odd pairing.
 */
export function chordsAt(points: readonly number[], y: number): { x0: number; x1: number }[] {
  const count = Math.floor(points.length / 2)
  const crossings: number[] = []
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = points[i * 2] ?? 0
    const yi = points[i * 2 + 1] ?? 0
    const xj = points[j * 2] ?? 0
    const yj = points[j * 2 + 1] ?? 0
    if (yi > y === yj > y) continue
    crossings.push(xi + ((y - yi) * (xj - xi)) / (yj - yi))
  }
  crossings.sort((a, b) => a - b)

  const spans: { x0: number; x1: number }[] = []
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const x0 = Math.ceil(crossings[i] ?? 0)
    const x1 = Math.floor(crossings[i + 1] ?? 0)
    if (x1 - x0 >= 2) spans.push({ x0, x1 })
  }
  return spans
}

/** Keeps marks off the very waterline, where the foam and the lily pads live. */
const SPOT_INNER = 0.08
const SPOT_OUTER = 0.8

/**
 * A random point inside the body: pick a waterline vertex, then walk a fraction
 * of the way toward the centre. Valid for any contour built by `blobContour`,
 * which is a radial function of the angle.
 */
export function pickWaterSpot(body: WaterBody, rand: () => number): Spot {
  const count = Math.floor(body.contour.length / 2)
  if (count < 3) return { x: body.center.x, y: body.center.y }
  const index = Math.floor(rand() * count)
  const edgeX = body.contour[index * 2] ?? body.center.x
  const edgeY = body.contour[index * 2 + 1] ?? body.center.y
  const t = SPOT_INNER + rand() * (SPOT_OUTER - SPOT_INNER)
  return {
    x: body.center.x + (edgeX - body.center.x) * t,
    y: body.center.y + (edgeY - body.center.y) * t,
  }
}

/** Shoelace area, so a pond gets fish in proportion to how much water it shows. */
function contourArea(points: readonly number[]): number {
  const count = Math.floor(points.length / 2)
  let sum = 0
  for (let i = 0, j = count - 1; i < count; j = i++) {
    sum += (points[j * 2] ?? 0) * (points[i * 2 + 1] ?? 0) - (points[i * 2] ?? 0) * (points[j * 2 + 1] ?? 0)
  }
  return Math.abs(sum) / 2
}

/** Ray casting against the waterline — used by the fish, which move freely. */
function insideBody(body: WaterBody, x: number, y: number): boolean {
  const points = body.contour
  const count = Math.floor(points.length / 2)
  let inside = false
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = points[i * 2] ?? 0
    const yi = points[i * 2 + 1] ?? 0
    const xj = points[j * 2] ?? 0
    const yj = points[j * 2 + 1] ?? 0
    if (yi > y === yj > y) continue
    if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Vertical extent of a body, so its crests know where to enter and leave. */
function yRange(points: readonly number[]): { min: number; max: number } {
  const count = Math.floor(points.length / 2)
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let i = 0; i < count; i++) {
    const y = points[i * 2 + 1] ?? 0
    if (y < min) min = y
    if (y > max) max = y
  }
  return { min, max }
}

/**
 * Picks the fish's next destination. Every option is inside the water by
 * construction, so a fish is never sent onto the bank in the first place.
 */
function retarget(one: Fish, rand: () => number, towardCentre = false): void {
  if (towardCentre) {
    // Back to the middle: the one direction that is always safe.
    one.targetX = one.body.center.x + (rand() - 0.5) * 16
    one.targetY = one.body.center.y + (rand() - 0.5) * 16
    return
  }
  const spot = pickWaterSpot(one.body, rand)
  one.targetX = spot.x
  one.targetY = spot.y
}

/** A tiny fish seen from above: a silhouette under the surface, glint on its back. */
function makeFishArt(skin: number, glint: number): { node: Container; tailIn: Graphics; tailOut: Graphics } {
  const node = new Container()
  const body = new Graphics().rect(-2, 0, 5, 1).fill({ color: skin, alpha: 1 })
  body.rect(-1, -1, 3, 1).fill({ color: skin, alpha: 1 })
  const tailIn = new Graphics().rect(-4, 0, 2, 1).fill({ color: skin, alpha: 1 })
  const tailOut = new Graphics().rect(-4, -1, 1, 1).fill({ color: skin, alpha: 1 })
  tailOut.rect(-4, 1, 1, 1).fill({ color: skin, alpha: 1 })
  const shine = new Graphics().rect(-1, -1, 1, 1).fill({ color: glint, alpha: 0.55 })
  node.addChild(tailIn, tailOut, body, shine)
  node.alpha = FISH_ALPHA
  return { node, tailIn, tailOut }
}

/**
 * Ambient water life: solid crest lines sloshing between every pond's shores and
 * arriving in sets, plus a few fish under the surface. Both are clipped to the
 * waterline — a crest to the pond's chord at its own row, a fish to the pond's
 * interior — so nothing ever lands on the grass.
 *
 * The weather keeps its own, faster rain rings on top.
 */
export function createWaterLife(layer: WaterLayer, services: SceneServices): WaterLife {
  const container = new Container()
  const { bodies, crest: tone, fish: skin } = layer
  if (bodies.length === 0) return { container, update: () => {} }

  const rand = services.random(20260415)

  // Fish go in first: a crest is a surface mark, so it has to draw over them.
  const fish: Fish[] = []
  for (const body of bodies) {
    const count = Math.min(FISH_MAX, Math.max(FISH_MIN, Math.round(contourArea(body.contour) / FISH_AREA)))
    for (let i = 0; i < count; i++) {
      const art = makeFishArt(skin, tone)
      container.addChild(art.node)
      const start = pickWaterSpot(body, rand)
      const entry: Fish = {
        ...art,
        body,
        x: start.x,
        y: start.y,
        targetX: start.x,
        targetY: start.y,
        speed: FISH_SPEED.min + rand() * (FISH_SPEED.max - FISH_SPEED.min),
        phase: rand() * 8,
      }
      retarget(entry, rand)
      fish.push(entry)
    }
  }

  const crests: Crest[] = []
  bodies.forEach((body) => {
    const range = yRange(body.contour)
    const height = Math.max(1, range.max - range.min)
    // Per-body phase offset: ponds never pump in unison.
    const phase = rand() * Math.PI * 2
    for (let i = 0; i < CREST_COUNT; i++) {
      const node = new Graphics()
      container.addChild(node)
      crests.push({
        node,
        body,
        range,
        phase,
        row: range.min + (height * i) / CREST_COUNT,
        drawnRow: Number.NaN,
        salt: Math.floor(rand() * 4096),
        shape: rand() * Math.PI * 2,
        // Each crest leans its own way — a pond of parallel lines is a corrugated roof.
        slope: (rand() * 2 - 1) * CREST_SLOPE,
        dir: 1,
      })
    }
  })

  const drawCrest = (crest: Crest, strength: number): void => {
    crest.node.clear()
    // Geometry comes from `crestDashes`, which has already dropped every dash that
    // is not on water at its own row.
    for (const dash of crestDashes(crest.body, crest.drawnRow, crest)) {
      // Rects are relative to the node, which already sits on the row. Drawing the
      // absolute row here would double it and drop the crest onto the grass.
      const y = dash.y - crest.drawnRow
      crest.node.rect(dash.x, y, dash.length, 1).fill({ color: tone, alpha: 1 })
      if (strength > 0.72) {
        // Only the biggest swells of a set carry a face under the crest.
        crest.node
          .rect(dash.x + 1, y + 1, Math.max(2, Math.round(dash.length * FACE_LENGTH)), 1)
          .fill({ color: tone, alpha: FACE_ALPHA })
      }
    }
  }

  const moveFish = (one: Fish, dt: number, elapsed: number): void => {
    let dx = one.targetX - one.x
    let dy = one.targetY - one.y
    let dist = Math.hypot(dx, dy)
    if (dist < 4) {
      retarget(one, rand)
      dx = one.targetX - one.x
      dy = one.targetY - one.y
      dist = Math.hypot(dx, dy) || 1
    }

    const step = Math.min(one.speed * dt, dist)
    const nx = one.x + (dx / dist) * step
    const ny = one.y + (dy / dist) * step
    // A fish is two pixels longer than its centre: both ends have to stay in the
    // water, so it turns back before its nose reaches the bank.
    const fits =
      insideBody(one.body, Math.round(nx - 4), Math.round(ny)) &&
      insideBody(one.body, Math.round(nx + 4), Math.round(ny))
    if (fits) {
      one.x = nx
      one.y = ny
    } else {
      retarget(one, rand, true)
    }

    one.node.position.set(Math.round(one.x), Math.round(one.y))
    one.node.scale.x = dx < 0 ? -1 : 1
    const beat = Math.floor(elapsed * FISH_TAIL_HZ + one.phase) % 2 === 0
    one.tailIn.visible = beat
    one.tailOut.visible = !beat
  }

  let setClock = 0
  let elapsed = 0
  const update = (dt: number, wind: SceneWind): void => {
    const hurry = 1 + wind.strength * 0.5
    setClock += dt / (SET_PERIOD / hurry)
    elapsed += dt

    for (const one of fish) moveFish(one, dt, elapsed)

    for (const crest of crests) {
      const { min, max } = crest.range
      const low = min - WRAP_MARGIN
      const high = max + WRAP_MARGIN

      crest.row += CREST_SPEED * hurry * dt * crest.dir
      // The swell reflects off each shore instead of wrapping: a pond sloshes
      // back and forth, and flipping the tilt is what makes it read as a bounce.
      if (crest.row >= high || crest.row <= low) {
        crest.row = crest.row >= high ? high : low
        crest.dir = crest.dir === 1 ? -1 : 1
        crest.slope = -crest.slope
        crest.drawnRow = Number.NaN
      }

      const strength = swellStrength(setClock + crest.phase)
      const row = Math.round(crest.row)
      if (row !== crest.drawnRow) {
        crest.drawnRow = row
        drawCrest(crest, strength)
      }
      // The node sits on the row, so its `y` *is* where the swell has reached.
      crest.node.y = row

      // Shoaling: the swell grows as it nears either shore, like real water.
      const half = Math.max(1, (max - min) / 2)
      const edge = Math.min(1, Math.abs(crest.row - (min + max) / 2) / half)
      crest.node.alpha = strength * (0.55 + 0.45 * edge)
    }
  }

  return { container, update }
}
