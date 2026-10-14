import { Container, Graphics } from 'pixi.js'
import { makeRandom } from './random'

/** Structural wind shared by the scene layers (weather supplies the real one). */
export interface SceneWind {
  x: number
  strength: number
}

export const CALM_WIND: SceneWind = { x: 0, strength: 0 }

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

export interface AmbienceSpec {
  readonly smoke?: readonly SmokeSpec[]
  readonly birds?: readonly BirdSpec[]
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

export interface Ambience {
  readonly container: Container
  update(dt: number, wind?: SceneWind): void
}

/**
 * Map-level ambience: smoke from the pack's chimneys and birds crossing its
 * lanes. The mechanics live in the kit; where the smoke and birds belong is
 * project data, so a new map only supplies an `AmbienceSpec`. Purely decorative —
 * never touches state.
 */
export function createAmbience(spec: AmbienceSpec = {}): Ambience {
  const container = new Container()
  const puffLayer = new Container()
  const birdLayer = new Container()
  container.addChild(puffLayer, birdLayer)

  const rnd = makeRandom(spec.seed ?? 90210)
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

  const update = (dt: number, wind: SceneWind = CALM_WIND): void => {
    clock += dt

    for (const bird of birds) {
      bird.node.x += (bird.speed + wind.x * 6) * dt
      bird.node.y = bird.baseY + Math.sin((clock + bird.phase) * 0.6) * 6
      const flap = Math.floor((clock + bird.phase) * 5.5) % 2 === 0
      bird.wingA.visible = flap
      bird.wingB.visible = !flap
      if (bird.node.x > worldWidth + 48) {
        bird.node.x = -48 - rnd() * 160
      }
    }

    if (smokePoints.length > 0) {
      smokeTimer -= dt
      if (smokeTimer <= 0) {
        smokeTimer = 1.15
        const point = smokePoints[smokeCursor % smokePoints.length]
        if (point) spawnPuff(point, wind)
        smokeCursor += 1
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
