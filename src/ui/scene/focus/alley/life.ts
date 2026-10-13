import { Container, Graphics } from 'pixi.js'
import { makeRandom } from '../../random'
import { Particles, SHADOW, smokePuff } from '../parts'
import type { Spot } from '../types'

export interface AlleyLife {
  container: Container
  update(dt: number, elapsed: number): void
}

/** Burning barrel, buzzing flies and a yard rat — ambient life for the alley. */
export function createAlleyLife(piles: Spot[]): AlleyLife {
  const container = new Container()
  const rnd = makeRandom(424242)

  const barrelX = 200
  const barrelY = 24

  const barrelArt = new Graphics()
  barrelArt.ellipse(barrelX + 1, barrelY + 4, 9, 6).fill(SHADOW)
  barrelArt.circle(barrelX, barrelY, 7).fill(0x5c6674)
  barrelArt.circle(barrelX, barrelY, 7).stroke({ width: 1, color: 0x454d59 })
  barrelArt.circle(barrelX, barrelY, 4.8).fill(0x2e333c)
  container.addChild(barrelArt)

  const glow = new Graphics().circle(barrelX, barrelY, 16).fill({ color: 0xffb454, alpha: 0.14 })
  container.addChild(glow)

  const flameA = new Graphics()
    .rect(barrelX - 3, barrelY - 3, 6, 6)
    .fill(0xff8a3d)
    .rect(barrelX - 1.5, barrelY - 1.5, 3, 3)
    .fill(0xffd27f)
  const flameB = new Graphics()
    .rect(barrelX - 2, barrelY - 4, 4, 7)
    .fill(0xff8a3d)
    .rect(barrelX - 1, barrelY - 2, 2, 3)
    .fill(0xffe6a8)
  flameB.visible = false
  container.addChild(flameA, flameB)

  const flyAnchors: Spot[] = [
    piles[0] ?? { x: 40, y: 32 },
    { x: barrelX, y: barrelY },
    piles[2] ?? { x: 160, y: 40 },
  ]
  const flyNodes = flyAnchors.map((anchor, index) => {
    const fly = new Graphics().rect(0, 0, 2, 2).fill(0x2b2320)
    container.addChild(fly)
    return { fly, anchor, phase: rnd() * 6.28, speed: 1.6 + index * 0.5 }
  })

  const rat = new Graphics()
    .ellipse(0, 0, 4, 2.2)
    .fill(0x4a4250)
    .rect(3.2, -0.8, 3.2, 1)
    .fill(0x4a4250)
    .circle(-2.2, -0.8, 1.4)
    .fill(0x5a5260)
  rat.visible = false
  container.addChild(rat)

  const particles = new Particles()
  container.addChild(particles.container)

  let smokeTimer = 0.3
  let ratTimer = 4 + rnd() * 6
  let ratX = 0
  let ratY = 0
  let ratTarget: Spot | null = null
  let ratDir: 1 | -1 = 1

  const update = (dt: number, elapsed: number): void => {
    const frame = Math.floor(elapsed * 8) % 2
    flameA.visible = frame === 0
    flameB.visible = frame === 1
    glow.alpha = 0.1 + 0.06 * (0.5 + 0.5 * Math.sin(elapsed * 6))

    for (const entry of flyNodes) {
      entry.phase += dt * entry.speed
      entry.fly.x = Math.round(entry.anchor.x + Math.sin(entry.phase) * 5)
      entry.fly.y = Math.round(entry.anchor.y + Math.cos(entry.phase * 1.7) * 3.6)
    }

    smokeTimer -= dt
    if (smokeTimer <= 0) {
      smokeTimer = 0.55
      particles.spawn(smokePuff(), barrelX + 1, barrelY - 6, { vx: 1.6, vy: -11, life: 1.3 })
    }
    particles.update(dt)

    if (ratTarget === null) {
      ratTimer -= dt
      if (ratTimer <= 0) {
        const from = piles[Math.floor(rnd() * piles.length)]
        const to = piles[Math.floor(rnd() * piles.length)]
        if (from && to && from !== to) {
          ratX = from.x
          ratY = from.y + 8
          ratTarget = { x: to.x, y: to.y + 8 }
          rat.visible = true
        }
      }
    } else {
      const dx = ratTarget.x - ratX
      if (Math.abs(dx) < 2) {
        rat.visible = false
        ratTarget = null
        ratTimer = 9 + rnd() * 9
      } else {
        ratDir = dx < 0 ? -1 : 1
        ratX += ratDir * 60 * dt
      }
      rat.scale.x = ratDir
      rat.position.set(Math.round(ratX), Math.round(ratY))
    }
  }

  return { container, update }
}