import { playSound } from '@ui/sound/player'
import { createSack, dustPuff, type Particles } from '../parts'
import type { Spot } from '../types'
import { createHaulerSprite, type HaulerSprite } from './sprites'

const WALK_SPEED = 30

export interface HaulerActor {
  update(dt: number, particles: Particles): void
  sprite: HaulerSprite
}

/** Work behaviour: carry sacks between the scale and the growing pile. */
export function createHauler(variant: number, pickup: Spot, dropoff: Spot): HaulerActor {
  const sprite = createHaulerSprite(variant)
  let seed = (variant * 40503 + 11) >>> 0 || 1
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const spread = (): Spot => ({
    x: dropoff.x + (rnd() - 0.5) * 16,
    y: dropoff.y + (rnd() - 0.5) * 8,
  })

  let x = pickup.x + (spread().x - pickup.x) * rnd()
  let y = pickup.y + (dropoff.y - pickup.y) * rnd()
  let carrying = false
  let target = pickup
  let pause = 0
  let clock = rnd() * 5
  let dustTimer = 0
  let facing = 1

  const update = (dt: number, particles: Particles): void => {
    clock += dt
    const container = sprite.container

    if (pause > 0) {
      pause -= dt
      sprite.body.y = Math.sin(clock * 3) * 0.5
      if (pause <= 0) {
        carrying = !carrying
        sprite.sack.visible = carrying
        if (carrying) {
          target = spread()
          sprite.armsL.x = -3.6
          sprite.armsR.x = 0.8
          playSound('sack-lift')
        } else {
          target = pickup
          sprite.armsL.x = -7.5
          sprite.armsR.x = 4.5
          particles.spawn(createSack(0.8), x + facing * 4, y - 10, {
            vx: facing * 12,
            vy: -12,
            life: 0.4,
            gravity: 52,
          })
          playSound('sack-drop')
        }
      }
    } else {
      const dx = target.x - x
      const dy = target.y - y
      const dist = Math.hypot(dx, dy)
      if (dist < 2) {
        pause = carrying ? 0.55 : 0.45
        sprite.legsL.x = -3.8
        sprite.legsR.x = 0.3
        sprite.body.y = 0
      } else {
        x += (dx / dist) * WALK_SPEED * dt
        y += (dy / dist) * WALK_SPEED * dt
        if (Math.abs(dx) > 3) facing = dx < 0 ? -1 : 1
        sprite.face.visible = !(dy < 0 && Math.abs(dy) > Math.abs(dx))
        const step = Math.floor(clock / 0.16) % 2 === 0 ? 1 : -1
        sprite.legsL.x = -3.8 + step * 1.4
        sprite.legsR.x = 0.3 - step * 1.4
        sprite.body.y = step > 0 ? -0.8 : 0
        if (!carrying) {
          sprite.armsL.x = -7.5 - step
          sprite.armsR.x = 4.5 + step
        }
        dustTimer -= dt
        if (dustTimer <= 0) {
          dustTimer = 0.5
          particles.spawn(dustPuff(), x - facing * 4, y + 1, {
            vx: -facing * 10,
            vy: -2,
            life: 0.4,
            gravity: 8,
          })
        }
      }
    }

    container.scale.x = facing
    container.x = Math.round(x)
    container.y = Math.round(y)
  }

  return { sprite, update }
}