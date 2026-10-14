import { playSound } from '@ui/sound/player'
import { createSack, createScrapBit, dustPuff, type Particles } from '../parts'
import { POKE, restPose, walkPose } from '../poses'
import type { Popups } from '../popups'
import type { Spot } from '../types'
import { createScavengerSprite, type ScavengerSprite } from './sprites'

const WALK_SPEED = 34
const BITS_PER_TRIP = 3

export interface PickerActor {
  update(dt: number, particles: Particles, popups: Popups): void
  sprite: ScavengerSprite
}

/**
 * Pick behaviour: walk between scrap piles (stepping legs, swinging arms, face
 * hides when walking north), poke cans out of the pile — one jab lands one can
 * in the plastic bag — then carry the full bag to the drop-off and hop while
 * emptying it.
 */
export function createPicker(variant: number, piles: Spot[], dropoff: Spot): PickerActor {
  const sprite = createScavengerSprite(variant)
  let seed = (variant * 2654435761) >>> 0 || 1
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  let x = piles[variant % piles.length]?.x ?? 0
  let y = piles[variant % piles.length]?.y ?? 0
  let target = piles[(variant + 1) % piles.length] ?? dropoff
  let mode: 'walk' | 'work' | 'drop' = 'walk'
  let timer = 0
  let workClock = 0
  let prevP = 0
  let headingToDrop = false
  let bits = 0
  let clock = rnd() * 8
  let dustTimer = 0
  let facing = 1

  const pickNextPile = (): void => {
    target = piles[Math.floor(rnd() * piles.length)] ?? dropoff
  }

  const update = (dt: number, particles: Particles, popups: Popups): void => {
    clock += dt
    const container = sprite.container

    if (mode === 'walk') {
      const dx = target.x - x
      const dy = target.y - y
      const dist = Math.hypot(dx, dy)
      if (dist < 2) {
        restPose(sprite)
        if (headingToDrop) {
          mode = 'drop'
          timer = 0.7
        } else {
          mode = 'work'
          workClock = 0
          prevP = 0
        }
      } else {
        x += (dx / dist) * WALK_SPEED * dt
        y += (dy / dist) * WALK_SPEED * dt
        if (Math.abs(dx) > 3) facing = dx < 0 ? -1 : 1
        sprite.face.visible = !(dy < 0 && Math.abs(dy) > Math.abs(dx))
        walkPose(sprite, clock)
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
    } else if (mode === 'work') {
      workClock += dt
      const p = (workClock % POKE.beat) / POKE.beat
      restPose(sprite)
      POKE.apply(sprite, p)
      if (prevP < 0.5 && p >= 0.5) {
        bits += 1
        sprite.bag.setFill(bits / BITS_PER_TRIP)
        popups.scrap(x, y - 40)
        playSound('poke')
        particles.spawn(createScrapBit(variant + bits), target.x, target.y - 6, {
          vx: (x - target.x) / 0.16,
          vy: -14,
          life: 0.32,
          gravity: 68,
        })
        if (bits >= BITS_PER_TRIP) headingToDrop = true
      }
      // Walk on only once the last beat has recovered, so the stick never snaps back.
      if (p < prevP && headingToDrop) {
        restPose(sprite)
        target = dropoff
        mode = 'walk'
      }
      prevP = p
    } else {
      timer -= dt
      const progress = 1 - Math.max(0, timer) / 0.7
      sprite.body.y = -Math.sin(Math.PI * progress) * 4
      if (timer <= 0) {
        sprite.body.y = 0
        sprite.bag.setFill(0)
        bits = 0
        headingToDrop = false
        particles.spawn(createSack(0.7), x + 4, y - 8, { vy: -6, life: 0.55, gravity: 28 })
        playSound('sack-drop')
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
