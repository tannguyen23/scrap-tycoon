import { playSound } from '@ui/sound/player'
import { CALM_WIND, type SceneWind } from '@scenery/core/ambience'
import { createSack, smokePuff, type Particles } from '../parts'
import type { Popups } from '../popups'
import { createTruckFrontSprite, createTruckSprite, type TruckFrontSprite, type TruckSprite } from './sprites'

/** Lane centre in the gate zone's local space (also used by the scene's road art). */
export const LANE_Y = 46

/** Ground line the standing truck rides on — keeps it inside the road band (28..64). */
const GROUND_Y = LANE_Y + 10

/** Loading bay in the yard; the crate stack sits just west of the roll door. */
const DOCK_X = 134
/** North lane of the main road (the avenue, world y 2864) the truck arrives on. */
const ROAD_Y = -152
/** Service driveway down from the road into the yard (world x 6324..6360). */
const DRIVEWAY_X = 78
/**
 * The exit lane in `worldLayout.GATE_EXIT_LANE` runs east from the zone's east
 * edge to the merge ramp back onto the avenue — so "off-map" in the zone's local
 * space is `width + ROAD_TAIL` (world x 7196, the corner by the trees where the
 * truck turns onto the highway).
 */
const ROAD_TAIL = 680

const ROAD_SPEED = 72
const DRIVEWAY_SPEED = 42
const YARD_SPEED = 46
const TURN_SECONDS = 0.55

export type TruckPhase = 'road' | 'turn' | 'driveway' | 'yard' | 'load' | 'depart' | 'wait'

/** Which body the truck shows: side art heading west (mirrored) / east, or the front view. */
type ViewKind = 'west' | 'south' | 'east'

export interface TruckActor {
  getPhase(): TruckPhase
  getX(): number
  getY(): number
  update(dt: number, particles: Particles, popups: Popups, wind?: SceneWind, mayEnter?: boolean): void
  /** Hide/show the whole truck (crew size), independent of which view is showing. */
  setActive(active: boolean): void
  /** Side view — the roll door lives here (the load phase toggles it). */
  sprite: TruckSprite
  /** Front view, shown while the truck drives the driveway toward the viewer. */
  front: TruckFrontSprite
}

/**
 * Export journey: the truck comes down the main road (west-bound, nose first),
 * turns into the service driveway and drives it toward the viewer, turns into the
 * yard and pulls up nose first at the dock — the roll door ends up beside the
 * crate stack. It loads, then drives out east past the barrier and off the map.
 * Every leg is driven forward; the view swaps only while the truck is stopped at a
 * corner, and it is hidden only once past the map edge. `mayEnter` keeps a second
 * truck waiting out on the road instead of letting two hulls overlap.
 */
export function createTruck(variant: number, width: number): TruckActor {
  const side = createTruckSprite(variant)
  const front = createTruckFrontSprite(variant)
  const mapEdgeX = width + ROAD_TAIL
  const entryX = mapEdgeX + 40 + variant * 56

  let active = true
  let south = false

  /** Một chỗ duy nhất quyết định view nào đang hiện (ẩn/hiện + hướng nhìn). */
  const applyVisibility = (): void => {
    side.container.visible = active && !south
    front.container.visible = active && south
  }

  let phase: TruckPhase = 'road'
  let pending: TruckPhase = 'driveway'
  let x = entryX
  let y = ROAD_Y
  let speed = YARD_SPEED
  let timer = 0
  let clock = 0
  let smokeTimer = 0
  let sacksToLoad = 2
  let billed = false

  const setView = (kind: ViewKind): void => {
    // Art hông xe vẽ hướng đông: đi về tây thì lật `scale.x` — đúng cách mọi nhân
    // vật/xe trong game quay mặt. View nhìn thẳng (nam) không lật.
    side.container.scale.x = kind === 'west' ? -1 : 1
    south = kind === 'south'
    applyVisibility()
  }

  /** The scene hides a parked crew member; the view choice stays the actor's. */
  const setActive = (value: boolean): void => {
    active = value
    applyVisibility()
  }
  // Vào map bằng đường lớn, chạy về tây: hông xe lật sẵn từ đầu.
  setView('west')

  const setDoor = (open: boolean): void => {
    side.doorOpen.visible = open
    side.doorClosed.visible = !open
  }

  const startTurn = (next: TruckPhase, view: ViewKind): void => {
    phase = 'turn'
    pending = next
    timer = TURN_SECONDS
    setView(view)
    playSound('vehicle-turn')
  }

  const update = (dt: number, particles: Particles, popups: Popups, wind: SceneWind = CALM_WIND, mayEnter = true): void => {
    clock += dt
    const startX = x
    const startY = y

    switch (phase) {
      case 'road': {
        // Queued trucks wait out on the road, off screen, until the dock frees up.
        if (!mayEnter && x > mapEdgeX) break
        x -= ROAD_SPEED * dt
        if (x <= DRIVEWAY_X) {
          x = DRIVEWAY_X
          startTurn('driveway', 'south')
        }
        break
      }
      case 'turn': {
        timer -= dt
        if (timer <= 0) {
          phase = pending
          if (phase === 'load') {
            timer = 1.5
            sacksToLoad = 2
            setDoor(true)
            playSound('truck-arrive')
          }
        }
        break
      }
      case 'driveway': {
        y += DRIVEWAY_SPEED * dt
        if (y >= GROUND_Y) {
          y = GROUND_Y
          startTurn('yard', 'east')
        }
        break
      }
      case 'yard': {
        x += YARD_SPEED * dt
        if (x >= DOCK_X) {
          x = DOCK_X
          startTurn('load', 'east')
        }
        break
      }
      case 'load': {
        timer -= dt
        const nextSackAt = sacksToLoad === 2 ? 1.15 : 0.75
        if (timer <= nextSackAt && sacksToLoad > 0) {
          sacksToLoad -= 1
          // Bao bốc từ chồng kiện ngay sau đuôi xe, tụt vào miệng thùng đang mở.
          particles.spawn(createSack(0.8), x - 32, 26, { vx: 26, vy: 4, life: 0.5, gravity: 40 })
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
        // Chỉ biến mất khi cả thùng xe đã ra khỏi bìa map.
        if (x > mapEdgeX + 40) {
          phase = 'wait'
          timer = 2.2
          setActive(false)
        }
        break
      }
      case 'wait': {
        timer -= dt
        if (timer <= 0) {
          x = entryX
          y = ROAD_Y
          speed = YARD_SPEED
          billed = false
          phase = 'road'
          setDoor(false)
          setActive(true)
          setView('west')
        }
        break
      }
    }

    // Bánh chỉ quay khi xe thật sự nhích: xe chờ lượt đứng yên ngoài bìa map. View
    // nhìn thẳng không có nan hoa nên không quay.
    const moving = x !== startX || y !== startY
    const spin = phase === 'road' ? ROAD_SPEED : phase === 'driveway' ? DRIVEWAY_SPEED : speed
    for (const wheel of side.wheels) wheel.spin(moving && !south ? spin : 0, dt)

    const bump = moving ? Math.sin(clock * 10) * 0.8 : 0
    for (const view of [side.container, front.container]) {
      view.x = Math.round(x)
      view.y = Math.round(y + bump)
    }
  }

  return {
    sprite: side,
    front,
    getPhase: () => phase,
    getX: () => x,
    getY: () => y,
    setActive,
    update,
  }
}
