import { Container, Graphics } from 'pixi.js'
import { makeRandom } from './random'
import { intersectsRect, inflateRect, type ViewRect } from './view'

/**
 * Gió toàn cục mà mọi thứ phản ứng theo (mây, mưa, cờ, khói, chim). Là hình
 * thuần: lớp thời tiết của dự án cấp giá trị thật, kit chỉ đọc.
 */
export interface SceneWind {
  x: number
  y: number
  strength: number
}

export const CALM_WIND: SceneWind = { x: 0, y: 0, strength: 0 }

/** A chimney (or any emitter) that puffs smoke into the wind. Pack data. */
export interface SmokeSpec {
  x: number
  y: number
}

/** One bird lane: birds cross the map at this height and speed. Pack data. */
export interface BirdSpec {
  x: number
  y: number
  speed: number
}

/**
 * A bird on the ground: it pecks about one patch and takes off now and then.
 * `radius` is how far it wanders from `x, y` — every landing is picked inside
 * that circle, so a bird can never drift away from the patch it was put on.
 */
export interface GroundBirdSpec {
  x: number
  y: number
  radius?: number
}

export interface AmbienceSpec {
  readonly smoke?: readonly SmokeSpec[]
  readonly birds?: readonly BirdSpec[]
  /** Birds that live on the ground: the map's own level, not the sky. */
  readonly groundBirds?: readonly GroundBirdSpec[]
  readonly seed?: number
  /** Map width, so a bird that flies off the east edge wraps around. */
  readonly worldWidth?: number
}

interface Puff {
  node: Graphics
  vx: number
  vy: number
  life: number
  maxLife: number
}

interface Bird {
  node: Container
  wingA: Graphics
  wingB: Graphics
  baseY: number
  speed: number
  phase: number
}

/** A ground bird: pecking about its patch, or in the air between two perches. */
interface GroundBird {
  readonly node: Container
  readonly folded: Graphics
  readonly spread: Graphics
  readonly homeX: number
  readonly homeY: number
  readonly radius: number
  readonly phase: number
  perchX: number
  perchY: number
  x: number
  y: number
  /** Seconds left in the current state. */
  timer: number
  flying: boolean
  progress: number
  targetX: number
  targetY: number
  fromX: number
  fromY: number
}

/** How long a take-off lasts, and how high it arcs. */
const FLY_SECONDS = 0.85
const FLY_HEIGHT = 15
/** Pecking spells between flights. */
const PECK_SECONDS = { min: 3, max: 9 } as const
const DEFAULT_PATCH = 18
const GROUND_BIRD_TONE = 0x332f2a
const GROUND_BIRD_BEAK = 0x9a8a5c

export interface Ambience {
  readonly container: Container
  /**
   * `view` (the world rect on screen) lets a big map skip work: smoke only spawns
   * from sources on camera, birds wrap around the visible band, ground birds far
   * away hold still. Without it the old whole-world behaviour stands.
   */
  update(dt: number, wind?: SceneWind, view?: ViewRect): void
}

/**
 * Map-level ambience: smoke from the pack's chimneys and birds crossing its
 * lanes. The mechanics live in the kit; where the smoke and birds belong is
 * project data, so a new map only supplies an `AmbienceSpec`. Purely decorative —
 * never touches state.
 */
export function createAmbience(spec: AmbienceSpec = {}): Ambience {
  const container = new Container()
  const groundLayer = new Container()
  const puffLayer = new Container()
  const birdLayer = new Container()
  container.addChild(groundLayer, puffLayer, birdLayer)

  const rnd = makeRandom(spec.seed ?? 90210)
  // Its own stream, so adding ground birds never re-rolls the sky lanes.
  const groundRnd = makeRandom((spec.seed ?? 90210) + 7)
  const smokePoints = spec.smoke ?? []
  const worldWidth = spec.worldWidth ?? 1280

  const birds: Bird[] = []
  for (const def of spec.birds ?? []) {
    const node = new Container()
    const wingA = new Graphics()
      .rect(-3, -4.4, 10, 2)
      .fill(0x3a3028)
      .rect(-3, 2.4, 10, 2)
      .fill(0x3a3028)
    const wingB = new Graphics()
      .rect(-3, -2.4, 10, 1.5)
      .fill(0x3a3028)
      .rect(-3, 0.9, 10, 1.5)
      .fill(0x3a3028)
    wingB.visible = false
    const body = new Graphics().rect(0, 0, 6, 2).fill(0x3a3028)
    node.addChild(wingA, wingB, body)
    node.position.set(def.x, def.y)
    birds.push({ node, wingA, wingB, baseY: def.y, speed: def.speed, phase: rnd() * 6 })
    birdLayer.addChild(node)
  }

  const groundBirds: GroundBird[] = []
  for (const def of spec.groundBirds ?? []) {
    const node = new Container()
    // Wings folded while it stands, spread while it is in the air.
    const folded = new Graphics().rect(-1, -1, 2, 1).fill(GROUND_BIRD_TONE)
    const spread = new Graphics()
      .rect(-3, -2, 7, 1)
      .fill(GROUND_BIRD_TONE)
      .rect(-3, 2, 7, 1)
      .fill(GROUND_BIRD_TONE)
    spread.visible = false
    const tail = new Graphics().rect(-3, 0, 2, 1).fill(GROUND_BIRD_TONE)
    const body = new Graphics().rect(-1, 0, 3, 2).fill(GROUND_BIRD_TONE)
    const head = new Graphics().rect(1, -1, 2, 2).fill(GROUND_BIRD_TONE)
    const beak = new Graphics().rect(3, 0, 1, 1).fill(GROUND_BIRD_BEAK)
    node.addChild(folded, spread, tail, body, head, beak)
    node.position.set(def.x, def.y)
    groundLayer.addChild(node)
    groundBirds.push({
      node,
      folded,
      spread,
      homeX: def.x,
      homeY: def.y,
      radius: def.radius ?? DEFAULT_PATCH,
      phase: groundRnd() * 6,
      perchX: def.x,
      perchY: def.y,
      x: def.x,
      y: def.y,
      timer: groundRnd() * PECK_SECONDS.max,
      flying: false,
      progress: 0,
      targetX: def.x,
      targetY: def.y,
      fromX: def.x,
      fromY: def.y,
    })
  }

  const puffs: Puff[] = []
  let smokeCursor = 0
  const spawnPuff = (point: SmokeSpec, wind: SceneWind): void => {
    const puff = new Graphics().rect(0, 0, 4, 4).fill({ color: 0xcfc6b2, alpha: 0.5 })
    puff.position.set(point.x, point.y)
    puffs.push({ node: puff, vx: -5 + wind.x * 18, vy: -14, life: 0, maxLife: 1.4 })
    puffLayer.addChild(puff)
  }

  let clock = 0
  let smokeTimer = 0.4

  const update = (dt: number, wind: SceneWind = CALM_WIND, view?: ViewRect): void => {
    clock += dt

    for (const bird of birds) {
      bird.node.x += (bird.speed + wind.x * 6) * dt
      bird.node.y = bird.baseY + Math.sin((clock + bird.phase) * 0.6) * 6
      const flap = Math.floor((clock + bird.phase) * 5.5) % 2 === 0
      bird.wingA.visible = flap
      bird.wingB.visible = !flap
      // With a view the lane wraps around the camera; without one, around the map.
      const wrapRight = view ? view.x + view.width + 48 : worldWidth + 48
      const wrapLeft = view ? view.x - 48 - rnd() * 160 : -48 - rnd() * 160
      if (bird.node.x > wrapRight) {
        bird.node.x = wrapLeft
      }
    }

    for (const bird of groundBirds) {
      // A bird off camera holds its pose: no walking, no timers, no cost.
      if (view) {
        const patch = inflateRect(
          { x: bird.homeX - bird.radius, y: bird.homeY - bird.radius, width: bird.radius * 2, height: bird.radius * 2 },
          32,
        )
        if (!intersectsRect(view, patch)) continue
      }
      bird.timer -= dt
      if (bird.flying) {
        bird.progress = Math.min(1, bird.progress + dt / FLY_SECONDS)
        const p = bird.progress
        // A shallow arc: up over the patch and back down onto the new spot.
        bird.x = bird.fromX + (bird.targetX - bird.fromX) * p
        bird.y = bird.fromY + (bird.targetY - bird.fromY) * p - Math.sin(Math.PI * p) * FLY_HEIGHT
        const flap = Math.floor((clock + bird.phase) * 9) % 2 === 0
        bird.folded.visible = flap
        bird.spread.visible = !flap
        if (p >= 1) {
          bird.flying = false
          bird.perchX = bird.targetX
          bird.perchY = bird.targetY
          bird.timer = PECK_SECONDS.min + groundRnd() * (PECK_SECONDS.max - PECK_SECONDS.min)
          bird.folded.visible = true
          bird.spread.visible = false
        }
      } else {
        // Pecking: a hop now and then, always on the spot it last landed on.
        const hop = Math.sin((clock + bird.phase) * 3) > 0.7 ? 1 : 0
        bird.x = bird.perchX
        bird.y = bird.perchY - hop
        if (bird.timer <= 0) {
          // Every landing is inside the patch, so a bird can never wander off it.
          const angle = groundRnd() * Math.PI * 2
          const away = groundRnd() * bird.radius
          bird.targetX = Math.round(bird.homeX + Math.cos(angle) * away)
          bird.targetY = Math.round(bird.homeY + Math.sin(angle) * away * 0.5)
          bird.fromX = bird.x
          bird.fromY = bird.y
          bird.progress = 0
          bird.flying = true
        }
      }
      bird.node.position.set(Math.round(bird.x), Math.round(bird.y))
      if (bird.flying) bird.node.scale.x = bird.targetX < bird.fromX ? -1 : 1
    }

    if (smokePoints.length > 0) {
      smokeTimer -= dt
      if (smokeTimer <= 0) {
        smokeTimer = 1.15
        const point = smokePoints[smokeCursor % smokePoints.length]
        smokeCursor += 1
        if (point) {
          // Off-camera chimneys still take their turn, they just do not puff.
          const onCamera =
            !view ||
            (point.x >= view.x - 32 &&
              point.x <= view.x + view.width + 32 &&
              point.y >= view.y - 32 &&
              point.y <= view.y + view.height + 32)
          if (onCamera) spawnPuff(point, wind)
        }
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const puff = puffs[i]
      if (!puff) continue
      puff.life += dt
      puff.node.x += puff.vx * dt
      puff.node.y += puff.vy * dt
      const progress = puff.life / puff.maxLife
      if (progress >= 1) {
        puffLayer.removeChild(puff.node)
        puff.node.destroy()
        puffs.splice(i, 1)
      } else {
        puff.node.alpha = 0.5 * (1 - progress)
      }
    }
  }

  return { container, update }
}
