import { createHammer, createPlasticBag, createPokingStick, type HeldItemSpec } from './heldItems'
import type { PersonSprite } from './parts'

/**
 * Shared choreography for the grounded person sprite: rest/walk poses plus a
 * registry of beat-based work actions (cúi nhặt, chọt lon — chặt cây later).
 * Limb nodes are only ever moved via `x` and the body only via `y`/`scale`, the
 * same vocabulary the actors use, so new actions never need new art hooks.
 * An action also owns its kit (see `items`) — tools belong to the move, not the
 * body, so any character can run any action.
 */

const REST_LEG_L = -3.8
const REST_LEG_R = 0.3
const REST_ARM_L = -7.5
const REST_ARM_R = 4.5

/** Grounded idle pose — the anchor every other pose departs from and returns to. */
export function restPose(sprite: PersonSprite): void {
  sprite.legsL.x = REST_LEG_L
  sprite.legsR.x = REST_LEG_R
  sprite.armsL.x = REST_ARM_L
  sprite.armsR.x = REST_ARM_R
  sprite.body.y = 0
  sprite.body.scale.set(1, 1)
  sprite.face.visible = true
}

export interface WalkOptions {
  /** Seconds per step frame — alley 0.15, depot 0.16. */
  stepTime?: number
  /** Carry poses keep the arms still. */
  swingArms?: boolean
  /** Vertical body bob per step. */
  bob?: boolean
}

/** Two-frame gait: legs step, arms swing, body bobs — the default is the alley walk. */
export function walkPose(sprite: PersonSprite, clock: number, options: WalkOptions = {}): void {
  const step = Math.floor(clock / (options.stepTime ?? 0.15)) % 2 === 0 ? 1 : -1
  sprite.legsL.x = REST_LEG_L + step * 1.4
  sprite.legsR.x = REST_LEG_R - step * 1.4
  if (options.swingArms ?? true) {
    sprite.armsL.x = REST_ARM_L - step
    sprite.armsR.x = REST_ARM_R + step
  }
  if (options.bob ?? true) sprite.body.y = step > 0 ? -0.8 : 0
}

/** Smoothstep: flat at both ends so beats loop without a visible seam. */
function ease(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

export interface WorkAction {
  readonly id: string
  readonly label: string
  /** Length of one beat in seconds. */
  readonly beat: number
  /**
   * Kit the action wears, attached to whatever body runs it via `equipItems`.
   * Tools travel with the move, which is what lets characters share actions —
   * 'chọt lon' hands the stick and bag to the hauler just as well as to the
   * scavenger. Actions that need no tools omit this.
   */
  readonly items?: readonly HeldItemSpec[]
  /**
   * Applies the pose for progress `p` in [0, 1). Contract: the caller resets
   * with `restPose` first — an action only moves arms/body, and at p = 0 it
   * must equal the rest pose so repeated beats read as one continuous motion.
   * Anything an action knocks loose (cans, chips) is the actor's job, not ours.
   */
  apply(sprite: PersonSprite, p: number): void
}

/** Crouch and pick — mirrors the pick pose the alley scavenger uses in-game. */
export const PICK: WorkAction = {
  id: 'pick',
  label: 'cúi nhặt',
  beat: 0.9,
  apply: (sprite, p) => {
    const down = p < 0.18 ? ease(p / 0.18) : p > 0.82 ? 1 - ease((p - 0.82) / 0.18) : 1
    sprite.body.scale.y = mix(1, 0.9, down)
    sprite.armsL.x = mix(REST_ARM_L, -5, down)
    sprite.armsR.x = mix(REST_ARM_R, 2, down)
  },
}

/**
 * Kit of the poke: plastic bag in the left hand, poking stick in the right.
 * Exported so the game's scavenger wears the very same kit the action declares.
 */
export const POKE_ITEMS: readonly HeldItemSpec<'bag' | 'stick'>[] = [
  { id: 'bag', hand: 'left', make: createPlasticBag, offset: { x: -2, y: 0.8 } },
  { id: 'stick', hand: 'right', make: createPokingStick },
]

/** Poke with the stick: pull back, jab forward, recover — one can per jab. */
export const POKE: WorkAction = {
  id: 'poke',
  label: 'chọt lon',
  beat: 0.55,
  items: POKE_ITEMS,
  apply: (sprite, p) => {
    const armR =
      p < 0.3
        ? mix(REST_ARM_R, 2.2, ease(p / 0.3))
        : p < 0.5
          ? mix(2.2, 8.2, ease((p - 0.3) / 0.2))
          : mix(8.2, REST_ARM_R, ease((p - 0.5) / 0.5))
    const armL =
      p < 0.3
        ? mix(REST_ARM_L, -6.2, ease(p / 0.3))
        : p < 0.5
          ? -6.2
          : mix(-6.2, REST_ARM_L, ease((p - 0.5) / 0.5))
    const dip =
      p < 0.3
        ? mix(1, 0.96, ease(p / 0.3))
        : p < 0.5
          ? mix(0.96, 0.93, ease((p - 0.3) / 0.2))
          : mix(0.93, 1, ease((p - 0.5) / 0.5))
    sprite.armsR.x = armR
    sprite.armsL.x = armL
    sprite.body.scale.y = dip
  },
}

/** Kit of the forge: a single sledge hammer in the right hand. */
export const HAMMER_ITEMS: readonly HeldItemSpec<'hammer'>[] = [
  { id: 'hammer', hand: 'right', make: createHammer },
]

/**
 * Đập búa trên đe: vung lên, giáng xuống, thu về — một nhịp một tiếng "clang".
 * Khoảnh khắc chạm đe là `p = 0.5`; actor bắn tia lửa + tiếng ngay tại đó.
 */
export const HAMMER: WorkAction = {
  id: 'hammer',
  label: 'đập búa',
  beat: 0.7,
  items: HAMMER_ITEMS,
  apply: (sprite, p) => {
    const armR =
      p < 0.42
        ? mix(REST_ARM_R, -3.4, ease(p / 0.42))
        : p < 0.5
          ? mix(-3.4, 9.4, ease((p - 0.42) / 0.08))
          : mix(9.4, REST_ARM_R, ease((p - 0.5) / 0.5))
    const armL =
      p < 0.42
        ? mix(REST_ARM_L, -9.4, ease(p / 0.42))
        : p < 0.5
          ? mix(-9.4, -3.4, ease((p - 0.42) / 0.08))
          : mix(-3.4, REST_ARM_L, ease((p - 0.5) / 0.5))
    const dip =
      p < 0.42
        ? mix(1, 0.985, ease(p / 0.42))
        : p < 0.5
          ? mix(0.985, 0.9, ease((p - 0.42) / 0.08))
          : mix(0.9, 1, ease((p - 0.5) / 0.5))
    sprite.armsR.x = armR
    sprite.armsL.x = armL
    sprite.body.scale.y = dip
  },
}

/** Every work action, for the studio picker (and actor lookups later). */
export const WORK_ACTIONS: readonly WorkAction[] = [PICK, POKE, HAMMER]
