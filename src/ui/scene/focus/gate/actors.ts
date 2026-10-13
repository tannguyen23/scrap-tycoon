import { createSack, smokePuff, type Particles } from '../parts'
import { createTruckSprite, type TruckSprite } from './sprites'

const LOAD_X = 100

/** Lane centre in the gate zone's local space (also used by the scene's road art). */
export const LANE_Y = 46

export type TruckPhase = 'arrive' | 'load' | 'depart' | 'wait'

export interface TruckActor {
  getPhase(): TruckPhase
  getX(): number
  update(dt: number, particles: Particles): void
  sprite: TruckSprite
}

/**
 * Haul behaviour loop: arrive empty, load sacks through the open rear door,
 * depart with smoke (the scene opens the boom barrier for departing trucks),
 * then wait off-map and return.
 */
export function createTruck(variant: number, width: number): TruckActor {
  const sprite = createTruckSprite(variant)
  let phase: TruckPhase = 'arrive'
  let x = -68 - variant * 60
  let speed = 60
  let timer = 0
  let clock = 0
  let smokeTimer = 0
  let sacksToLoad = 2

  const setDoor = (open: boolean): void => {
    sprite.doorOpen.visible = open
    sprite.doorClosed.visible = !open
  }

  const update = (dt: number, particles: Particles): void => {
    clock += dt
    const container = sprite.container

    switch (phase) {
      case 'arrive': {
        x += speed * dt
        if (x >= LOAD_X) {
          x = LOAD_X
          phase = 'load'
          timer = 1.5
          sacksToLoad = 2
          setDoor(true)
        }
        break
      }
      case 'load': {
        timer -= dt
        const nextSackAt = sacksToLoad === 2 ? 1.15 : 0.75
        if (timer <= nextSackAt && sacksToLoad > 0) {
          sacksToLoad -= 1
          particles.spawn(createSack(0.8), x - 32, 24, { vx: 32, vy: -24, life: 0.45, gravity: 52 })
        }
        if (timer <= 0.35) setDoor(false)
        if (timer <= 0) {
          phase = 'depart'
          speed = 60
        }
        break
      }
      case 'depart': {
        speed = Math.min(speed + 88 * dt, 132)
        x += speed * dt
        smokeTimer -= dt
        if (smokeTimer <= 0) {
          smokeTimer = 0.13
          particles.spawn(smokePuff(), x - 26, 5, { vx: -24, vy: -4, life: 0.55 })
        }
        if (x > width + 28) {
          phase = 'wait'
          timer = 2.2
          container.visible = false
        }
        break
      }
      case 'wait': {
        timer -= dt
        if (timer <= 0) {
          x = -68 - variant * 48
          speed = 60
          phase = 'arrive'
          container.visible = true
          setDoor(false)
        }
        break
      }
    }

    const moving = phase === 'arrive' || phase === 'depart'
    for (const wheel of sprite.wheels) {
      wheel.spin(moving ? (phase === 'arrive' ? 60 : speed) : 0, dt)
    }
    const bump = moving ? Math.sin(clock * 10) * 0.8 : 0
    container.x = Math.round(x)
    container.y = Math.round(LANE_Y + bump)
  }

  return {
    sprite,
    getPhase: () => phase,
    getX: () => x,
    update,
  }
}