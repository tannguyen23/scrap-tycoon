import type { Rect } from '@ground/core/metrics'
import { ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import { Container } from 'pixi.js'
import { playSound } from '@ui/sound/player'
import type { HeldItem } from '../focus/heldItems'
import { equipItems } from '../focus/heldItems'
import { createPersonSprite, dustPuff, Particles, type BodyStyle } from '../focus/parts'
import { HAMMER, PICK, POKE, restPose, walkPose, type WorkAction } from '../focus/poses'
import { installMoveKeys, isSprinting, moveVector, type MoveKeys } from './keys'
import { buildBlockers, slideMove, WALKER_RADIUS, zoneAt, type Blockers, type Spot } from './walkable'

/**
 * The player: one body that walks the world with WASD and works by hand.
 *
 * It is a `WorldLayer` of the project — the kit draws it and calls `update`, and
 * the camera follows `position` (a live spot handed to `SceneHandle.setFollow`).
 * The layer's `root` always sits in the world; the **body** inside it is what
 * moves: standing in a yard reparents the body into that yard's `actors` layer,
 * so the yard's own per-frame `sortByDepth` makes the player walk **behind** its
 * stacks and sheds like any other actor. In the wild the body stays in `root`,
 * under the couriers.
 */

export type WorkPose = 'pick' | 'poke' | 'hammer'

export interface PlayerReadout {
  x: number
  y: number
  /** Yard the feet are standing in, or null in the wild. */
  zone: string | null
  moving: boolean
  working: boolean
}

export interface PlayerLayer {
  readonly root: Container
  /** Read by reference every frame by the camera — do not replace the object. */
  readonly position: Spot
  update(dt: number, view: Rect): void
  /** Start (or stop) a hand-work animation; the HUD owns how long a stroke takes. */
  setWorking(pose: WorkPose | null): void
  /** Stand still while a full-screen HUD panel owns the screen (the inventory). */
  setFrozen(frozen: boolean): void
  /** Dress the body from gear (`BodyStyle`); rebuilds the sprite, keeping the kits. */
  setLook(look: BodyStyle): void
  /** Gear bonus applied on top of the base walk speed (modifier pipeline). */
  setWalkMultiplier(multiplier: number): void
  readout(): PlayerReadout
  destroy(): void
}

/**
 * Spawn just inside the alley's south gate — the chain's first yard. Deliberately BESIDE
 * the gather pile, not on it: the pile's base box blocks (as every standing prop does),
 * and a walker spawned inside a box cannot take a single step.
 */
export const PLAYER_SPAWN: Spot = { x: 4120, y: 2396 }

/** Yards run from ~250px (the depot) to 672px (the scrap alley); walking one takes a few seconds. */
export const WALK_SPEED = 62
export const SPRINT_MULTIPLIER = 1.7
/** Seconds per walk frame — matched to the couriers' cadence. */
const STEP_TIME = 0.16
/** How often a step puffs dust, seconds. */
const DUST_TIME = 0.5

const POSES: Record<WorkPose, WorkAction> = { pick: PICK, poke: POKE, hammer: HAMMER }
/** What one strike sounds like, per job — played once per beat, at the midpoint. */
const STRIKE_SOUND: Record<WorkPose, 'poke' | 'clang' | 'sack-lift'> = {
  pick: 'sack-lift',
  poke: 'poke',
  hammer: 'clang',
}

const ZONE_RECTS: Record<string, Rect> = {}
for (const [id, layout] of Object.entries(ZONE_LAYOUTS)) ZONE_RECTS[id] = layout.rect

export interface PlayerOptions {
  /** Zone id → that zone's `actors` container, for depth sorting (see the module doc). */
  readonly hosts: Readonly<Record<string, Container>>
  readonly spawn?: Spot
}

export function createPlayer(options: PlayerOptions): PlayerLayer {
  const blockers: Blockers = buildBlockers()
  const keys: MoveKeys = installMoveKeys()
  const position: Spot = { ...(options.spawn ?? PLAYER_SPAWN) }

  let facing = 1
  let clock = 0
  let workClock = 0
  let dustTimer = DUST_TIME
  let step = 0
  let moving = false
  let working: WorkPose | null = null
  /** True while a HUD panel holds the screen — the walker stands still. */
  let frozen = false
  /** Gear bonus on top of `WALK_SPEED` (from the modifier pipeline, pushed by the scene). */
  let walkMultiplier = 1

  // Layer container (owned by the kit, always in the world) and the body that
  // travels between the world and a yard's depth layer.
  const root = new Container()
  const body = new Container()
  let sprite = createPersonSprite(0, 'straw')
  const particles = new Particles()
  body.addChild(sprite.container, particles.container)
  root.addChild(body)

  // Every kit is worn once and toggled per pose: re-equipping on each change
  // would stack a second stick into the same hand.
  const kits = new Map<WorkAction, Record<string, HeldItem>>()
  const wearKit = (action: WorkAction | null): void => {
    for (const [owner, items] of kits) {
      const visible = owner === action
      for (const item of Object.values(items)) item.container.visible = visible
    }
  }
  const dressKits = (): void => {
    kits.clear()
    for (const action of [PICK, POKE, HAMMER]) {
      if (!action.items) continue
      kits.set(action, equipItems(sprite, action.items))
    }
    wearKit(working ? POSES[working] : null)
  }
  /**
   * Rebuilds the body with a new look (gear). A rebuild — rather than making every
   * limb layer runtime-swappable — keeps `createPersonSprite` the single place that
   * draws a person; the kits travel with the arms, so they are re-worn here.
   */
  const dress = (look: BodyStyle): void => {
    const previous = sprite
    const index = body.getChildIndex(previous.container)
    sprite = createPersonSprite(0, 'straw', look)
    body.addChildAt(sprite.container, index)
    body.removeChild(previous.container)
    previous.container.destroy({ children: true })
    dressKits()
  }
  dressKits()

  /** Space the body is parented in: null = the wild, otherwise a yard id. */
  let hostZone: string | null = null

  const enterHost = (zoneId: string | null): void => {
    hostZone = zoneId
    const host = zoneId ? options.hosts[zoneId] : undefined
    if (host) host.addChild(body)
    else root.addChild(body)
  }

  const render = (): void => {
    const rect = hostZone ? ZONE_RECTS[hostZone] : undefined
    body.position.set(Math.round(position.x - (rect?.x ?? 0)), Math.round(position.y - (rect?.y ?? 0)))
  }
  render()

  const update = (dt: number, _view: Rect): void => {
    clock += dt
    const vector = frozen ? { x: 0, y: 0 } : moveVector(keys.pressed)
    const wanted = vector.x !== 0 || vector.y !== 0
    const speed = WALK_SPEED * (isSprinting(keys.pressed) ? SPRINT_MULTIPLIER : 1) * walkMultiplier

    const beforeX = position.x
    const beforeY = position.y
    if (wanted) {
      const next = slideMove(blockers, position, vector.x * speed * dt, vector.y * speed * dt, WALKER_RADIUS)
      position.x = next.x
      position.y = next.y
    }
    moving = Math.hypot(position.x - beforeX, position.y - beforeY) > 0.01

    // Standing in a yard hands the body to that yard's depth layer.
    const zone = zoneAt(position.x, position.y)
    if (zone !== hostZone) enterHost(zone)
    render()

    if (wanted && vector.x !== 0) facing = vector.x < 0 ? -1 : 1
    sprite.container.scale.x = facing

    if (working) {
      const action = POSES[working]
      workClock += dt
      const p = (workClock % action.beat) / action.beat
      const previous = ((workClock - dt) % action.beat) / action.beat
      restPose(sprite)
      action.apply(sprite, p)
      wearKit(action)
      // One sound per strike, never per frame.
      if (previous < 0.5 && p >= 0.5) playSound(STRIKE_SOUND[working])
    } else {
      wearKit(null)
      if (moving) {
        walkPose(sprite, clock, { stepTime: STEP_TIME })
        const nextStep = Math.floor(clock / STEP_TIME) % 2
        if (nextStep !== step) {
          step = nextStep
          playSound('footstep')
        }
        dustTimer += dt
        if (dustTimer >= DUST_TIME) {
          dustTimer = 0
          const rect = hostZone ? ZONE_RECTS[hostZone] : undefined
          particles.spawn(
            dustPuff(),
            position.x - (rect?.x ?? 0) - facing * 4,
            position.y - (rect?.y ?? 0) + 1,
            { vx: -facing * 10, vy: -2, life: 0.4, gravity: 8 },
          )
        }
      } else {
        restPose(sprite)
        dustTimer = DUST_TIME
      }
    }

    // Walking north hides the face (the ¾-view back read) — set after any pose.
    sprite.face.visible = !(wanted && vector.y < 0 && Math.abs(vector.y) > Math.abs(vector.x))
    particles.update(dt)
  }

  return {
    root,
    position,
    update,
    setWorking: (pose) => {
      if (pose === working) return
      working = pose
      workClock = 0
    },
    setFrozen: (next) => {
      frozen = next
      // Keys held when the panel opened would otherwise keep the walker running
      // (its keydown is already gone, so the keyup would never clear them).
      if (next) keys.clear()
    },
    setLook: (look) => dress(look),
    setWalkMultiplier: (next) => {
      walkMultiplier = next > 0 ? next : 1
    },
    readout: () => ({ x: position.x, y: position.y, zone: hostZone, moving, working: working !== null }),
    destroy: () => keys.dispose(),
  }
}
