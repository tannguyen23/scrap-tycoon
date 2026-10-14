import { playSound } from '@ui/sound/player'
import { createScrapBit, dustPuff, type Particles } from '../parts'
import { HAMMER, restPose, walkPose } from '../poses'
import type { Popups } from '../popups'
import type { Spot } from '../types'
import { createSmithSprite, type SmithSprite } from './sprites'

const WALK_SPEED = 26
const STRIKES_PER_TRIP = 3

export interface SmithActor {
  update(dt: number, particles: Particles, popups: Popups): void
  sprite: SmithSprite
}

export interface SmithSpots {
  /** Chồng bao phế liệu do bốc vác mang tới. */
  pile: Spot
  /** Cửa lò nấu. */
  hearth: Spot
  /** Đe — nơi đập búa. */
  anvil: Spot
  /** Chồng pallet phôi cho ba gác tới lấy. */
  stack: Spot
}

/**
 * Chu trình thợ rèn: bốc bao ở chồng bao → chất vào cửa lò → mang phôi ra đe →
 * đập `STRIKES_PER_TRIP` nhịp (mỗi nhịp tóe hạt + một tiếng "clang") → khiêng phôi
 * ra chồng pallet. Trạng thái đọc theo `spot`, không đụng art ngoài `sprites`.
 */
export function createSmith(variant: number, spots: SmithSpots): SmithActor {
  const sprite = createSmithSprite(variant)
  let seed = (variant * 2246822519 + 7) >>> 0 || 1
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const spread = (spot: Spot): Spot => ({
    x: spot.x + (rnd() - 0.5) * 14,
    y: spot.y + (rnd() - 0.5) * 8,
  })

  let x = spots.pile.x + (rnd() - 0.5) * 20
  let y = spots.pile.y + (rnd() - 0.5) * 12
  let mode: 'walk' | 'hammer' = 'walk'
  let phase: 'toPile' | 'toHearth' | 'toAnvil' | 'toStack' = 'toPile'
  let target: Spot = spread(spots.pile)
  let pause = 0
  let workClock = 0
  let prevP = 0
  let strikes = 0
  let clock = rnd() * 6
  let dustTimer = 0
  let facing = 1

  const startWalk = (next: typeof phase, spot: Spot): void => {
    phase = next
    target = spread(spot)
    mode = 'walk'
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
        pause -= dt
        if (pause > 0) return
        if (phase === 'toPile') {
          sprite.sack.visible = true
          sprite.armsL.x = -4.4
          sprite.armsR.x = 1.2
          playSound('sack-lift')
          pause = 0.35
          startWalk('toHearth', spots.hearth)
        } else if (phase === 'toHearth') {
          sprite.sack.visible = false
          particles.spawn(createScrapBit(variant), x + facing * 4, y - 10, {
            vx: facing * 10,
            vy: -16,
            life: 0.35,
            gravity: 60,
          })
          playSound('sack-drop')
          sprite.billet.visible = true
          sprite.armsL.x = -4.4
          sprite.armsR.x = 1.2
          pause = 0.3
          startWalk('toAnvil', spots.anvil)
        } else if (phase === 'toAnvil') {
          strikes = 0
          workClock = 0
          prevP = 0
          mode = 'hammer'
        } else {
          sprite.billet.visible = false
          popups.scrap(x, y - 40)
          playSound('sack-drop')
          sprite.armsL.x = -7.5
          sprite.armsR.x = 4.5
          pause = 0.4
          startWalk('toPile', spots.pile)
        }
      } else {
        x += (dx / dist) * WALK_SPEED * dt
        y += (dy / dist) * WALK_SPEED * dt
        if (Math.abs(dx) > 3) facing = dx < 0 ? -1 : 1
        sprite.face.visible = !(dy < 0 && Math.abs(dy) > Math.abs(dx))
        const carrying = sprite.sack.visible || sprite.billet.visible
        walkPose(sprite, clock, { swingArms: !carrying, stepTime: 0.18 })
        dustTimer -= dt
        if (dustTimer <= 0) {
          dustTimer = 0.55
          particles.spawn(dustPuff(), x - facing * 4, y + 1, {
            vx: -facing * 12,
            vy: -2,
            life: 0.4,
            gravity: 8,
          })
        }
      }
    } else {
      workClock += dt
      const p = (workClock % HAMMER.beat) / HAMMER.beat
      restPose(sprite)
      HAMMER.apply(sprite, p)
      sprite.billet.visible = false
      if (prevP < 0.5 && p >= 0.5) {
        strikes += 1
        playSound('clang')
        for (let i = 0; i < 3; i++) {
          particles.spawn(createScrapBit(variant + i), x + facing * 7, y - 13, {
            vx: facing * (8 + rnd() * 22) - 6,
            vy: -22 - rnd() * 18,
            life: 0.38,
            gravity: 120,
          })
        }
        if (strikes >= STRIKES_PER_TRIP) {
          restPose(sprite)
          sprite.billet.visible = true
          sprite.armsL.x = -4.4
          sprite.armsR.x = 1.2
          startWalk('toStack', spots.stack)
          prevP = p
          container.scale.x = facing
          container.x = Math.round(x)
          container.y = Math.round(y)
          return
        }
      }
      prevP = p
    }

    container.scale.x = facing
    container.x = Math.round(x)
    container.y = Math.round(y)
  }

  return { sprite, update }
}
