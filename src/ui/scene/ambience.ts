import { Container, Graphics } from 'pixi.js'
import { makeRandom } from './random'
import { WORLD_WIDTH } from './zoneLayout'

interface Cloud {
  node: Graphics
  speed: number
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

/** Chimney on the depot warehouse roof (world coordinates of the map art). */
const CHIMNEY = { x: 164, y: 564 }

export interface Ambience {
  readonly container: Container
  update(dt: number): void
}

/**
 * Map-level ambience: cloud shadows drifting across the yard, smoke from the
 * depot chimney and birds crossing. Purely decorative — never touches state.
 */
export function createAmbience(): Ambience {
  const container = new Container()
  const cloudLayer = new Container()
  const puffLayer = new Container()
  const birdLayer = new Container()
  container.addChild(cloudLayer, puffLayer, birdLayer)

  const rnd = makeRandom(90210)

  const cloudDefs = [
    { x: -140, y: 104, rx: 104, ry: 48, speed: 10 },
    { x: 500, y: 392, rx: 84, ry: 38, speed: 6.8 },
    { x: 260, y: 232, rx: 64, ry: 28, speed: 8.6 },
  ]
  const clouds: Cloud[] = []
  for (const def of cloudDefs) {
    const cloud = new Graphics().ellipse(0, 0, def.rx, def.ry).fill({ color: 0x0a0e16, alpha: 0.06 })
    cloud.position.set(def.x, def.y)
    clouds.push({ node: cloud, speed: def.speed })
    cloudLayer.addChild(cloud)
  }

  const puffs: Puff[] = []
  let smokeTimer = 0.4

  // Chim bay ngang bãi — hai frame đập cánh.
  const birds: Bird[] = []
  const birdDefs = [
    { x: -60, y: 88, speed: 44 },
    { x: -300, y: 164, speed: 52 },
    { x: -560, y: 128, speed: 38 },
  ]
  for (const def of birdDefs) {
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

  let clock = 0

  const update = (dt: number): void => {
    clock += dt
    for (const cloud of clouds) {
      cloud.node.x += cloud.speed * dt
      if (cloud.node.x > WORLD_WIDTH + 140) cloud.node.x = -140
    }

    for (const bird of birds) {
      bird.node.x += bird.speed * dt
      bird.node.y = bird.baseY + Math.sin((clock + bird.phase) * 0.6) * 6
      const flap = Math.floor((clock + bird.phase) * 5.5) % 2 === 0
      bird.wingA.visible = flap
      bird.wingB.visible = !flap
      if (bird.node.x > WORLD_WIDTH + 48) {
        bird.node.x = -48 - rnd() * 160
      }
    }

    smokeTimer -= dt
    if (smokeTimer <= 0) {
      smokeTimer = 1.15
      const puff = new Graphics().rect(0, 0, 4, 4).fill({ color: 0xcfc6b2, alpha: 0.5 })
      puff.position.set(CHIMNEY.x, CHIMNEY.y)
      puffs.push({ node: puff, vx: -5, vy: -14, life: 0, maxLife: 1.4 })
      puffLayer.addChild(puff)
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
