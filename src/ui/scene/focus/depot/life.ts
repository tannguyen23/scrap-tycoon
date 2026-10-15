import { Container, Graphics } from 'pixi.js'
import { makeRandom } from '../../random'
import { playSound } from '@ui/sound/player'
import { SHADOW } from '../parts'
import type { Spot } from '@scene/core/types'

export interface DepotLife {
  container: Container
  update(dt: number, elapsed: number): void
}

/** A yard cat napping on the sack pile, tail flicking, blinking now and then. */
export function createDepotLife(spot: Spot): DepotLife {
  const container = new Container()
  const rnd = makeRandom(5150)

  const cat = new Container()
  const shadow = new Graphics().ellipse(1, 1.6, 7, 3.6).fill(SHADOW)
  const tail = new Graphics().rect(4.8, -4.4, 2, 4.4).fill(0xa39a8f)
  const body = new Graphics().ellipse(0, -5.2, 6, 4.8).fill(0xa39a8f)
  const chest = new Graphics().ellipse(0, -3.6, 4, 3.2).fill(0xb3aaa0)
  const stripes = new Graphics()
    .rect(-4, -9.2, 1.5, 7)
    .fill({ color: 0x8b8078, alpha: 0.8 })
    .rect(1, -8.4, 1.5, 6)
    .fill({ color: 0x8b8078, alpha: 0.8 })
  const head = new Graphics().circle(0, -12.2, 4).fill(0xb3aaa0)
  const earL = new Graphics().rect(-3.8, -16.4, 2.4, 2.8).fill(0xa39a8f)
  const earR = new Graphics().rect(1.4, -16.4, 2.4, 2.8).fill(0xa39a8f)
  const eyes = new Graphics()
    .rect(-2.4, -12.8, 1.2, 1.4)
    .fill(0x23272e)
    .rect(1.2, -12.8, 1.2, 1.4)
    .fill(0x23272e)
  const muzzle = new Graphics().rect(-1, -10.4, 2, 1.2).fill(0xe6ddcb)
  const nose = new Graphics().rect(-0.5, -10.9, 1, 0.6).fill(0xd88a8a)
  const paws = new Graphics()
    .rect(-3.2, -2.8, 2.8, 2.4)
    .fill(0xb3aaa0)
    .rect(0.4, -2.8, 2.8, 2.4)
    .fill(0xb3aaa0)
  cat.addChild(shadow, tail, body, chest, stripes, head, earL, earR, eyes, muzzle, nose, paws)
  cat.position.set(spot.x, spot.y)
  container.addChild(cat)

  let blinkTimer = 2 + rnd() * 3
  let blinking = 0
  let meowTimer = 20 + rnd() * 40

  const update = (dt: number, elapsed: number): void => {
    tail.x = 4.8 + Math.sin(elapsed * 2.2 + 0.6) * 1
    tail.y = -4.4 + Math.sin(elapsed * 2.2) * 1.2

    meowTimer -= dt
    if (meowTimer <= 0) {
      meowTimer = 25 + rnd() * 45
      playSound('cat')
    }

    if (blinking > 0) {
      blinking -= dt
      eyes.visible = false
    } else {
      blinkTimer -= dt
      if (blinkTimer <= 0) {
        blinking = 0.12
        blinkTimer = 3 + rnd() * 3
      }
      eyes.visible = true
    }
  }

  return { container, update }
}