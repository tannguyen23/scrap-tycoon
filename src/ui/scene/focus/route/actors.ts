import { playSound } from '@ui/sound/player'
import { dustPuff, type Particles } from '../parts'
import { routeVehicleSprite, type VehicleSprite } from './sprites'

const DRIVE_SPEED = 52

export interface VehicleActor {
  update(dt: number, particles: Particles): void
  sprite: VehicleSprite
}

/** Drive behaviour: loop a road lane, spin wheels, kick dust, turn at both ends. */
export function createRouteVehicle(
  variant: number,
  width: number,
  laneCenter: number,
  tier: number,
): VehicleActor {
  const sprite = routeVehicleSprite(tier, variant)
  const fromX = 20
  const toX = width - 52
  const lane = laneCenter + (variant % 2 === 0 ? -6 : 6)

  let x = fromX + ((variant * 61) % Math.max(1, toX - fromX))
  let dir: 1 | -1 = variant % 2 === 0 ? 1 : -1
  let pause = 0
  let clock = variant * 1.7
  let dustTimer = 0

  const update = (dt: number, particles: Particles): void => {
    clock += dt
    const moving = pause <= 0

    if (moving) {
      x += dir * DRIVE_SPEED * dt
      if (x >= toX) {
        x = toX
        dir = -1
        pause = 0.8
        playSound('vehicle-turn')
      } else if (x <= fromX) {
        x = fromX
        dir = 1
        pause = 0.8
        playSound('vehicle-turn')
      }
    } else {
      pause = Math.max(0, pause - dt)
    }

    for (const wheel of sprite.wheels) {
      wheel.spin(moving ? DRIVE_SPEED : 0, dt)
    }

    dustTimer -= dt
    if (moving && dustTimer <= 0) {
      dustTimer = 0.36
      particles.spawn(dustPuff(), x - dir * 16, lane + 1, { vx: -dir * 16, vy: -2, life: 0.4, gravity: 6 })
    }

    const bump = moving ? Math.sin(clock * 11) * 1 : 0
    const container = sprite.container
    container.scale.x = dir
    container.scale.y = moving ? 1 : 0.96
    container.x = Math.round(x)
    container.y = Math.round(lane + bump)
  }

  return { sprite, update }
}