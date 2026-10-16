import { Container, Graphics } from 'pixi.js'
import { intersectsRect, type ViewRect } from './view'

/** Real seconds for one full day. */
export const DAY_LENGTH_SECONDS = 480
const START_TIME = 0.34

interface AmbientKey {
  /** Time of day in 0..1 (0 = midnight). */
  t: number
  color: number
  alpha: number
}

/** Colour grade over the day: cool nights, warm sunrise/sunset, clear noon. */
const AMBIENT: readonly AmbientKey[] = [
  { t: 0.0, color: 0x5566b0, alpha: 0.58 },
  { t: 0.2, color: 0x6670b8, alpha: 0.5 },
  { t: 0.28, color: 0xffb08a, alpha: 0.22 },
  { t: 0.36, color: 0xffe8c8, alpha: 0.07 },
  { t: 0.46, color: 0xffffff, alpha: 0 },
  { t: 0.6, color: 0xffffff, alpha: 0 },
  { t: 0.68, color: 0xffd8a8, alpha: 0.12 },
  { t: 0.76, color: 0xff9a5a, alpha: 0.24 },
  { t: 0.84, color: 0x7a6bb8, alpha: 0.4 },
  { t: 1.0, color: 0x5566b0, alpha: 0.58 },
]

const NIGHT_ALPHA = 0.5

/** One warm light pool of the map (a lamp, a window, a fire). Pack data. */
export interface LightSource {
  x: number
  y: number
  radius: number
  color: number
  /** 0..1 — how much the pool breathes, for fires. */
  flicker?: number
}

export interface AmbientSample {
  color: number
  alpha: number
}

/** Colour grade at a moment of the day (0..1) — also used by the studio swatches. */
export function sampleAmbient(time: number): AmbientSample {
  const first = AMBIENT[0] ?? { t: 0, color: 0xffffff, alpha: 0 }
  let prev = first
  for (let i = 1; i < AMBIENT.length; i++) {
    const next = AMBIENT[i] ?? first
    if (time <= next.t) {
      const span = next.t - prev.t || 1
      const k = (time - prev.t) / span
      return {
        color: lerpColor(prev.color, next.color, k),
        alpha: prev.alpha + (next.alpha - prev.alpha) * k,
      }
    }
    prev = next
  }
  return { color: prev.color, alpha: prev.alpha }
}

export interface LightingOptions {
  /** Advance the clock automatically (game); the studio drives `setTime` instead. */
  auto?: boolean
  /** Start time in 0..1. */
  time?: number
}

export interface Lighting {
  readonly container: Container
  /**
   * `view` (the world rect on screen) keeps the colour grade tied to the screen —
   * a quad the size of a 10240px world would be a full-map fill every frame — and
   * culls the light pools that are off camera.
   */
  update(dt: number, view?: ViewRect): void
  setTime(time: number): void
  getTime(): number
}

/**
 * Day/night lighting: a multiply colour grade over the visible area plus stepped
 * additive light pools around lamps, windows and fires. The grade curve is kit
 * behaviour; the pools come from the project's `SceneryPack`. Purely visual —
 * driven by the scene clock, never by game state.
 */
export function createLighting(
  world: { width: number; height: number },
  lights: readonly LightSource[] = [],
  options: LightingOptions = {},
): Lighting {
  const auto = options.auto ?? true
  let time = options.time ?? START_TIME
  let clock = 0

  const container = new Container()
  const ambient = new Graphics()
  ambient.blendMode = 'multiply'
  container.addChild(ambient)

  // The grade quad matches the viewport, not the world: resized only when the
  // view size changes, repositioned as the camera pans.
  let ambientWidth = -1
  let ambientHeight = -1
  const resizeAmbient = (width: number, height: number): void => {
    if (width === ambientWidth && height === ambientHeight) return
    ambientWidth = width
    ambientHeight = height
    ambient.clear().rect(0, 0, width, height).fill(0xffffff)
  }
  resizeAmbient(world.width, world.height)

  const lightNodes = lights.map((light) => {
    const node = new Container()
    const g = new Graphics()
      .circle(0, 0, light.radius)
      .fill({ color: light.color, alpha: 0.1 })
      .circle(0, 0, light.radius * 0.62)
      .fill({ color: light.color, alpha: 0.16 })
      .circle(0, 0, light.radius * 0.32)
      .fill({ color: light.color, alpha: 0.26 })
    node.addChild(g)
    node.position.set(light.x, light.y)
    node.blendMode = 'add'
    node.alpha = 0
    container.addChild(node)
    return { node, light }
  })

  const apply = (view?: ViewRect): void => {
    if (view) {
      resizeAmbient(view.width, view.height)
      ambient.position.set(Math.round(view.x), Math.round(view.y))
    }
    const sample = sampleAmbient(time)
    ambient.tint = sample.color
    ambient.alpha = sample.alpha
    const night = Math.min(1, sample.alpha / NIGHT_ALPHA)
    for (const { node, light } of lightNodes) {
      if (view) {
        node.visible = intersectsRect(view, {
          x: light.x - light.radius,
          y: light.y - light.radius,
          width: light.radius * 2,
          height: light.radius * 2,
        })
      }
      const flicker = light.flicker ? 1 + Math.sin(clock * 9 + light.x) * light.flicker : 1
      node.alpha = night * flicker
    }
  }

  const update = (dt: number, view?: ViewRect): void => {
    clock += dt
    if (auto) time = (time + dt / DAY_LENGTH_SECONDS) % 1
    apply(view)
  }

  apply()
  return {
    container,
    update,
    setTime: (next: number) => {
      time = ((next % 1) + 1) % 1
      apply()
    },
    getTime: () => time,
  }
}

function lerpColor(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 0xff
  const ag = (a >> 8) & 0xff
  const ab = a & 0xff
  const br = (b >> 16) & 0xff
  const bg = (b >> 8) & 0xff
  const bb = b & 0xff
  const r = Math.round(ar + (br - ar) * k)
  const g = Math.round(ag + (bg - ag) * k)
  const bl = Math.round(ab + (bb - ab) * k)
  return (r << 16) | (g << 8) | bl
}
