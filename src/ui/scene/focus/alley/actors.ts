import { createSack, createScrapBit, dustPuff, type Particles } from '../parts'
import type { Spot } from '../types'
import { createPickerSprite, type PickerSprite } from './sprites'

const WALK_SPEED = 34
const BITS_PER_TRIP = 3

export interface PickerActor {
  update(dt: number, particles: Particles): void
  sprite: PickerSprite
}

/**
 * Pick behaviour: walk between scrap piles (stepping legs, swinging arms, face
 * hides when walking north), crouch to pick (scrap bits arc into the bag), then
 * carry the full bag to the drop-off and hop while emptying it.
 */
export function createPicker(variant: number, piles: Spot[], dropoff: Spot): PickerActor {
  const sprite = createPickerSprite(variant)
  let seed = (variant * 2654435761) >>> 0 || 1
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  let x = piles[variant % piles.length]?.x ?? 0
  let y = piles[variant % piles.length]?.y ?? 0
  let target = piles[(variant + 1) % piles.length] ?? dropoff
  let mode: 'walk' | 'pick' | 'drop' = 'walk'
  let timer = 0
  let headingToDrop = false
  let picksFull = 0
  let bits = 0
  let clock = rnd() * 8
  let dustTimer = 0
  let facing = 1

  const pickNextPile = (): void => {
    target = piles[Math.floor(rnd() * piles.length)] ?? dropoff
  }

  const restPose = (): void => {
    sprite.legsL.x = -3.8
    sprite.legsR.x = 0.3
    sprite.armsL.x = -7.5
    sprite.armsR.x = 4.5
    sprite.body.y = 0
    sprite.face.visible = true
  }

  const update = (dt: number, particles: Particles): void => {
    clock += dt
    const container = sprite.container

    if (mode === 'walk') {
      const dx = target.x - x
      const dy = target.y - y
      const dist = Math.hypot(dx, dy)
      if (dist < 2) {
        restPose()
        if (headingToDrop) {
          mode = 'drop'
          timer = 0.7
        } else {
          mode = 'pick'
          timer = 0.9
        }
      } else {
        x += (dx / dist) * WALK_SPEED * dt
        y += (dy / dist) * WALK_SPEED * dt
        if (Math.abs(dx) > 3) facing = dx < 0 ? -1 : 1
        sprite.face.visible = !(dy < 0 && Math.abs(dy) > Math.abs(dx))
        const step = Math.floor(clock / 0.15) % 2 === 0 ? 1 : -1
        sprite.legsL.x = -3.8 + step * 1.4
        sprite.legsR.x = 0.3 - step * 1.4
        sprite.armsL.x = -7.5 - step
        sprite.armsR.x = 4.5 + step
        sprite.body.y = step > 0 ? -0.8 : 0
        dustTimer -= dt
        if (dustTimer <= 0) {
          dustTimer = 0.42
          particles.spawn(dustPuff(), x - facing * 4, y + 1, {
            vx: -facing * 14,
            vy: -3,
            life: 0.45,
            gravity: 8,
          })
        }
      }
    } else if (mode === 'pick') {
      timer -= dt
      sprite.face.visible = true
      sprite.body.scale.set(1, 0.9)
      sprite.armsL.x = -5
      sprite.armsR.x = 2
      if (timer <= 0) {
        sprite.body.scale.set(1, 1)
        restPose()
        bits += 1
        sprite.bag.visible = true
        sprite.bag.scale.set(0.55 + bits * 0.16)
        particles.spawn(createScrapBit(variant + bits), target.x, target.y - 6, {
          vx: (x - target.x) / 0.16,
          vy: -14,
          life: 0.32,
          gravity: 68,
        })
        picksFull += 1
        if (picksFull >= BITS_PER_TRIP) {
          headingToDrop = true
          target = dropoff
        } else {
          pickNextPile()
        }
        mode = 'walk'
      }
    } else {
      timer -= dt
      const progress = 1 - Math.max(0, timer) / 0.7
      sprite.body.y = -Math.sin(Math.PI * progress) * 4
      if (timer <= 0) {
        sprite.body.y = 0
        sprite.bag.scale.set(1)
        sprite.bag.visible = false
        bits = 0
        picksFull = 0
        headingToDrop = false
        particles.spawn(createSack(0.7), x + 4, y - 8, { vy: -6, life: 0.55, gravity: 28 })
        pickNextPile()
        mode = 'walk'
      }
    }

    container.scale.x = facing
    container.x = Math.round(x)
    container.y = Math.round(y)
  }

  return { sprite, update }
}