import { Container, Graphics } from 'pixi.js'
import type { PersonSprite } from './parts'

/** A prop a character carries in one hand, built once and reused by any sprite. */
export interface HeldItem {
  readonly container: Container
  /** Fill level 0..1 — the bag swells and its cans appear; items without a fill are a no-op. */
  setFill(amount: number): void
}

export type Hand = 'left' | 'right'

/**
 * Centre of the drawn hand inside an arm container (hand = rect(0, -8.4, 3, 2.4)),
 * so items parented to `armsL`/`armsR` sit in the palm. Parenting to the arm is
 * what makes the item swing with the gait and thrust with a work beat for free,
 * and it mirrors with `container.scale.x` — no counter-flip needed.
 */
export const HAND_ANCHOR = { x: 1.5, y: -7.2 } as const

const PLASTIC = 0xe4f2f6
const PLASTIC_SHADE = 0x9fc2ce
const CAN_METAL = 0xb9c2c9
const CAN_LID = 0xe4e9ed

function createCan(x: number, y: number): Graphics {
  const can = new Graphics()
  can.rect(x, y, 1.9, 2.7).fill(CAN_METAL)
  can.rect(x, y, 1.9, 0.7).fill(CAN_LID)
  can.rect(x, y + 1.5, 1.9, 0.8).fill({ color: 0x9fb8a8, alpha: 0.85 })
  can.rect(x, y + 0.7, 0.5, 2).fill({ color: 0xffffff, alpha: 0.2 })
  return can
}

/** Crinkled plastic bag that hangs from the grip — swells as cans drop in. */
export function createPlasticBag(): HeldItem {
  const container = new Container()

  const strands = new Graphics()
  strands.rect(-2, -0.4, 0.9, 3).fill({ color: PLASTIC, alpha: 0.95 })
  strands.rect(1.1, -0.4, 0.9, 3).fill({ color: PLASTIC, alpha: 0.95 })

  const body = new Graphics()
  body.rect(-3.25, 2.6, 6.5, 5.6).fill({ color: PLASTIC, alpha: 0.92 })
  body.rect(-3.25, 2.6, 6.5, 1).fill({ color: 0xffffff, alpha: 0.4 })
  body.rect(1.85, 3.2, 1.4, 4.3).fill({ color: PLASTIC_SHADE, alpha: 0.4 })
  body.rect(-3.25, 7.5, 6.5, 0.7).fill({ color: PLASTIC_SHADE, alpha: 0.35 })

  // Back can first so it peeks from behind the front row.
  const cans = [createCan(-0.95, 2.9), createCan(-2.15, 4.6), createCan(0.25, 4.6)]

  // A translucent sheet over the cans so they read as being inside the plastic.
  const sheen = new Graphics()
  sheen.rect(-3.25, 2.6, 6.5, 5.6).fill({ color: PLASTIC, alpha: 0.25 })
  sheen.rect(-2.1, 3.8, 0.7, 3.2).fill({ color: 0xffffff, alpha: 0.25 })
  sheen.rect(0.6, 4.2, 0.6, 2.8).fill({ color: PLASTIC_SHADE, alpha: 0.3 })

  container.addChild(strands, body, ...cans, sheen)

  return {
    container,
    setFill: (amount: number) => {
      const clamped = Math.max(0, Math.min(1, amount))
      const shown = Math.ceil(clamped * cans.length)
      cans.forEach((can, index) => {
        can.visible = index < shown
      })
      container.scale.set(1 + clamped * 0.15)
    },
  }
}

/** Bamboo poking stick with a bent wire hook — snags cans out of the pile. */
export function createPokingStick(): HeldItem {
  const container = new Container()

  const shaft = new Graphics()
  shaft.rect(-4.5, -0.9, 15.5, 1.8).fill(0xc9a55b)
  shaft.rect(-4.5, -0.9, 15.5, 0.6).fill({ color: 0xffffff, alpha: 0.2 })
  shaft.rect(-4.5, 0.4, 15.5, 0.5).fill({ color: 0x000000, alpha: 0.14 })
  shaft.rect(2.2, -0.9, 0.9, 1.8).fill({ color: 0x8f6f3c, alpha: 0.85 })
  shaft.rect(6.6, -0.9, 0.9, 1.8).fill({ color: 0x8f6f3c, alpha: 0.85 })

  const hook = new Graphics()
  hook.rect(10.2, -1.3, 2.6, 2.6).fill(0x9aa8b6)
  hook.rect(10.2, -1.3, 2.6, 0.8).fill({ color: 0xffffff, alpha: 0.25 })
  hook.rect(11.6, 1.3, 1.2, 2.7).fill(0x8a97a6)
  hook.rect(11.6, 3.2, 1.2, 0.8).fill(0x74818f)

  // Dark wrap where the palm closes around the shaft.
  const grip = new Graphics().rect(-1.6, -1.1, 3.2, 2.2).fill({ color: 0x8a6d3e, alpha: 0.9 })

  container.addChild(shaft, hook, grip)

  return { container, setFill: () => {} }
}

/** Sledge hammer — steel cross-peen head on a wooden shaft, gripped low. */
export function createHammer(): HeldItem {
  const container = new Container()

  const shaft = new Graphics()
  shaft.rect(-4.4, -0.9, 13.4, 1.8).fill(0xb98d52)
  shaft.rect(-4.4, -0.9, 13.4, 0.55).fill({ color: 0xffffff, alpha: 0.2 })
  shaft.rect(-4.4, 0.5, 13.4, 0.4).fill({ color: 0x000000, alpha: 0.14 })

  const head = new Graphics()
  head.rect(7.4, -2.7, 4.6, 5.4).fill(0x8b939c)
  head.rect(7.4, -2.7, 4.6, 1.1).fill({ color: 0xdfe6ec, alpha: 0.85 })
  head.rect(7.4, 1.0, 4.6, 1.7).fill({ color: 0x000000, alpha: 0.18 })
  head.rect(11.2, -1.8, 1.5, 3.6).fill(0x6f767e)

  const grip = new Graphics().rect(-1.6, -1.1, 3.2, 2.2).fill({ color: 0x7a5a34, alpha: 0.9 })

  container.addChild(shaft, head, grip)

  return { container, setFill: () => {} }
}

/** Parents a held item to the chosen arm, in the palm — see HAND_ANCHOR. */
export function attachHeldItem(
  sprite: PersonSprite,
  item: HeldItem,
  hand: Hand,
  offset?: { x: number; y: number },
): void {
  const arm = hand === 'left' ? sprite.armsL : sprite.armsR
  item.container.position.set(HAND_ANCHOR.x + (offset?.x ?? 0), HAND_ANCHOR.y + (offset?.y ?? 0))
  arm.addChild(item.container)
}

/** One piece of kit a work action wears, declared next to the action itself. */
export interface HeldItemSpec<Id extends string = string> {
  /** Name the attached item is looked up by afterwards — e.g. 'bag'. */
  id: Id
  hand: Hand
  make: () => HeldItem
  offset?: { x: number; y: number }
}

/**
 * Dresses any body with a kit and hands the items back keyed by id, so callers
 * can keep animating them (the bag swells as cans come in). Because the kit
 * travels with the spec — not the sprite — every character can share an action.
 */
export function equipItems<Id extends string>(
  sprite: PersonSprite,
  specs: readonly HeldItemSpec<Id>[],
): Record<Id, HeldItem> {
  const equipped = {} as Record<Id, HeldItem>
  for (const spec of specs) {
    const item = spec.make()
    attachHeldItem(sprite, item, spec.hand, spec.offset)
    equipped[spec.id] = item
  }
  return equipped
}
