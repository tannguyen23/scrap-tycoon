import { D0, Decimal } from '@core/num'
import { carryCapFor } from './capacity'
import type { Modifiers } from './modifiers'
import type { BagSlot, GameContent, GameState, ItemId } from './types'

/**
 * Bag slot mechanics. The bag is a fixed-length list of slots; a slot holds one
 * stack of a single item (capped by that item's `carry` × `item.<id>.carry` and
 * `global.carry`), and items may be split across several slots. This module owns
 * every add/remove/move so no caller ever reaches into the array by hand.
 */

/** Fallback bag size when content does not declare one (`GameContent.bagSlots`). */
export const DEFAULT_BAG_SLOTS = 18

export function bagSlotCount(content: GameContent): number {
  const declared = content.bagSlots
  return typeof declared === 'number' && Number.isFinite(declared) && declared > 0
    ? Math.floor(declared)
    : DEFAULT_BAG_SLOTS
}

/** A fresh, empty bag of the content's size. */
export function emptyBag(content: GameContent): (BagSlot | null)[] {
  return new Array<BagSlot | null>(bagSlotCount(content)).fill(null)
}

/** Everything the player carries of one item, summed across slots. */
export function bagTotal(state: GameState, itemId: ItemId): Decimal {
  let total = D0
  for (const slot of state.bag) {
    if (slot && slot.item === itemId) total = total.add(slot.amount)
  }
  return total
}

/** The per-slot stack ceiling for an item, or null when it cannot be carried at all. */
function stackCap(content: GameContent, mods: Map<string, Modifiers>, itemId: ItemId): Decimal | null {
  const cap = carryCapFor(content, itemId, mods)
  return cap && cap.gt(0) ? cap : null
}

/** How many more units of `itemId` the bag can take. 0 when it cannot be carried. */
export function bagRoom(
  state: GameState,
  content: GameContent,
  mods: Map<string, Modifiers>,
  itemId: ItemId,
): Decimal {
  const cap = stackCap(content, mods, itemId)
  if (!cap) return D0
  let room = D0
  for (const slot of state.bag) {
    if (!slot) {
      room = room.add(cap)
    } else if (slot.item === itemId) {
      const left = cap.sub(slot.amount)
      if (left.gt(0)) room = room.add(left)
    }
  }
  return room
}

/**
 * Adds up to `amount` of one item, topping up slots that already hold it before
 * opening empty ones. Returns how much actually fit (0 when the bag is full or
 * the item cannot be carried).
 */
export function bagAdd(
  state: GameState,
  content: GameContent,
  mods: Map<string, Modifiers>,
  itemId: ItemId,
  amount: Decimal,
): Decimal {
  const cap = stackCap(content, mods, itemId)
  if (!cap || amount.lte(0)) return D0
  let left = amount
  for (const slot of state.bag) {
    if (left.lte(0)) break
    if (!slot || slot.item !== itemId) continue
    const space = cap.sub(slot.amount)
    if (space.lte(0)) continue
    const take = space.lt(left) ? space : left
    slot.amount = slot.amount.add(take)
    left = left.sub(take)
  }
  for (let i = 0; i < state.bag.length && left.gt(0); i++) {
    if (state.bag[i]) continue
    const take = cap.lt(left) ? cap : left
    state.bag[i] = { item: itemId, amount: take }
    left = left.sub(take)
  }
  return amount.sub(left)
}

/**
 * Lays `amount` of one item into slots starting at `from`, splitting past the
 * per-slot ceiling. Never overwrites an occupied slot, so a saved arrangement
 * keeps its gaps. Returns how much actually fit.
 */
export function bagPlaceFrom(
  state: GameState,
  content: GameContent,
  mods: Map<string, Modifiers>,
  from: number,
  itemId: ItemId,
  amount: Decimal,
): Decimal {
  const cap = stackCap(content, mods, itemId)
  if (!cap || amount.lte(0)) return D0
  let left = amount
  for (let i = Math.max(0, Math.floor(from)); i < state.bag.length && left.gt(0); i++) {
    if (state.bag[i]) continue
    const take = cap.lt(left) ? cap : left
    state.bag[i] = { item: itemId, amount: take }
    left = left.sub(take)
  }
  return amount.sub(left)
}

/** Removes up to `amount` of one item across slots, emptying slots as they dry up. */
export function bagRemove(state: GameState, itemId: ItemId, amount: Decimal): Decimal {
  if (amount.lte(0)) return D0
  let left = amount
  for (let i = 0; i < state.bag.length && left.gt(0); i++) {
    const slot = state.bag[i]
    if (!slot || slot.item !== itemId) continue
    const take = slot.amount.lt(left) ? slot.amount : left
    slot.amount = slot.amount.sub(take)
    left = left.sub(take)
    if (slot.amount.lte(0)) state.bag[i] = null
  }
  return amount.sub(left)
}

/**
 * Drag-and-drop inside the bag. An empty target takes the stack whole; a target
 * holding the same item merges as much as fits (the remainder stays put); any
 * other target swaps the two stacks. Returns true when the bag changed.
 */
export function bagMove(
  state: GameState,
  content: GameContent,
  mods: Map<string, Modifiers>,
  from: number,
  to: number,
): boolean {
  if (from === to || to < 0 || to >= state.bag.length) return false
  const src = state.bag[from]
  if (!src) return false
  const dst = state.bag[to] ?? null
  if (!dst) {
    state.bag[to] = src
    state.bag[from] = null
    return true
  }
  if (dst.item === src.item) {
    const cap = stackCap(content, mods, src.item)
    if (!cap) return false
    const space = cap.sub(dst.amount)
    if (space.lte(0)) return false
    const take = space.lt(src.amount) ? space : src.amount
    dst.amount = dst.amount.add(take)
    const left = src.amount.sub(take)
    if (left.lte(0)) state.bag[from] = null
    else src.amount = left
    return true
  }
  state.bag[from] = dst
  state.bag[to] = src
  return true
}
