import { playSound } from '@ui/sound/player'
import { CALM_WIND, type Wind } from '../../weather'
import { createSack, smokePuff, type Particles } from '../parts'
import type { Popups } from '../popups'
import { createTruckSprite, type TruckSprite } from './sprites'

/** Dock centre: the roll door on the truck's west end lands beside the crate stack. */
const LOAD_X = 100
/**
 * The exit lane in `zoneLayout.CONNECTORS` runs past the zone's east edge all the
 * way to the map edge — that stretch is the city access road the trucks use, so
 * "off-map" in the zone's local space is `width + ROAD_TAIL` (world x 1280).
 */
const ROAD_TAIL = 164
const REVERSE_SPEED = 42

/** Lane centre in the gate zone's local space (also used by the scene's road art). */
export const LANE_Y = 46

/** Ground line the standing truck rides on — keeps it inside the road band (28..64). */
const GROUND_Y = LANE_Y + 10

export type TruckPhase = 'arrive' | 'load' | 'depart' | 'wait'

export interface TruckActor {
  getPhase(): TruckPhase
  getX(): number
  update(dt: number, particles: Particles, popups: Popups, wind?: Wind, mayEnter?: boolean): void
  sprite: TruckSprite
}

/**
 * Export loop: the city truck backs in along the access road from the map's east
 * edge — rear door first, so it is the tail that appears on screen and the tail
 * that ends up facing the crate stack. It loads through the open roll door at the
 * dock, then drives out nose-first, past the boom barrier and off the map. The
 * truck is only ever hidden once past the map edge (never while still on the
 * road), and `mayEnter` keeps a second truck waiting out there instead of letting
 * two hulls overlap at the single dock.
 */
export function createTruck(variant: number, width: number): TruckActor {
  const sprite = createTruckSprite(variant)
  const mapEdgeX = width + ROAD_TAIL
  const entryX = mapEdgeX + 36 + variant * 56

  let phase: TruckPhase = 'arrive'
  let x = entryX
  let speed = REVERSE_SPEED
  let timer = 0
  let clock = 0
  let smokeTimer = 0
  let sacksToLoad = 2
  let billed = false

  const setDoor = (open: boolean): void => {
    sprite.doorOpen.visible = open
    sprite.doorClosed.visible = !open
  }

  const update = (dt: number, particles: Particles, popups: Popups, wind: Wind = CALM_WIND, mayEnter = true): void => {
    clock += dt
    const container = sprite.container
    const startX = x

    switch (phase) {
      case 'arrive': {
        // Queued trucks wait out on the road (off screen) until the dock frees up;
        // one already on the lane always finishes backing in.
        if (!mayEnter && x > mapEdgeX) break
        x -= REVERSE_SPEED * dt
        if (x <= LOAD_X) {
          x = LOAD_X
          phase = 'load'
          timer = 1.5
          sacksToLoad = 2
          setDoor(true)
          playSound('truck-arrive')
        }
        break
      }
      case 'load': {
        timer -= dt
        const nextSackAt = sacksToLoad === 2 ? 1.15 : 0.75
        if (timer <= nextSackAt && sacksToLoad > 0) {
          sacksToLoad -= 1
          // Bay từ sau đuôi vào miệng thùng đang mở (ngang tầm cửa cuốn).
          particles.spawn(createSack(0.8), x - 32, 40, { vx: 32, vy: -6, life: 0.5, gravity: 36 })
          playSound('sack-throw')
        }
        if (timer <= 0.35) setDoor(false)
        if (timer <= 0) {
          phase = 'depart'
          speed = 60
          playSound('truck-depart')
        }
        break
      }
      case 'depart': {
        speed = Math.min(speed + 88 * dt, 132)
        x += speed * dt
        // Hàng xuất: chạy qua trạm (thanh chắn ~x 191) là một lần "+ tiền".
        if (!billed && x > 196) {
          billed = true
          popups.money(x, GROUND_Y - 42)
          playSound('cash')
        }
        smokeTimer -= dt
        if (smokeTimer <= 0) {
          smokeTimer = 0.13
          particles.spawn(smokePuff(), x - 30, GROUND_Y - 2, { vx: -24 + wind.x * 30, vy: -5, life: 0.55 })
        }
        // Chỉ biến mất khi đã ra khỏi bìa map — không còn tan biến giữa làn.
        if (x > mapEdgeX + 40) {
          phase = 'wait'
          timer = 2.2
          container.visible = false
        }
        break
      }
      case 'wait': {
        timer -= dt
        if (timer <= 0) {
          x = entryX
          speed = REVERSE_SPEED
          phase = 'arrive'
          billed = false
          container.visible = true
          setDoor(false)
        }
        break
      }
    }

    // Bánh chỉ quay khi xe thật sự nhích: xe đang chờ lượt đứng yên ngoài bìa map.
    const moving = x !== startX
    for (const wheel of sprite.wheels) {
      wheel.spin(moving ? (phase === 'arrive' ? REVERSE_SPEED : speed) : 0, dt)
    }
    const bump = moving ? Math.sin(clock * 10) * 0.8 : 0
    container.x = Math.round(x)
    container.y = Math.round(GROUND_Y + bump)
  }

  return {
    sprite,
    getPhase: () => phase,
    getX: () => x,
    update,
  }
}
