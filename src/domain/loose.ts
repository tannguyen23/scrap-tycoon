import { isZoneUnlocked } from './conditions'
import type { GameContent, GameState, LooseItem } from './types'

/** The key a spawn def's clock is stored under (content keeps one def per zone+item). */
export function looseDefKey(zone: string, item: string): string {
  return `${zone}:${item}`
}

/**
 * Scatters each yard's debris over time, up to that def's cap. The only writer of
 * `state.loose` besides `pickLoose`, and it lives OUTSIDE the save: a reload
 * re-scatters. A yard that is still locked gathers no litter — no loot in a place
 * you cannot enter.
 */
export function looseSpawnTick(state: GameState, content: GameContent, dt: number): void {
  const defs = content.loose
  if (!defs || defs.length === 0 || dt <= 0) return
  for (const def of defs) {
    const key = looseDefKey(def.zone, def.item)
    if (!isZoneUnlocked(state, content, def.zone)) {
      state.loose.clocks[key] = 0
      continue
    }
    let live = 0
    for (const piece of state.loose.items) {
      if (piece.zone === def.zone && piece.item === def.item) live += 1
    }
    if (live >= def.cap) {
      // At the cap the clock just holds, so a pickup frees the slot at once.
      state.loose.clocks[key] = def.secondsPerItem
      continue
    }
    let clock = (state.loose.clocks[key] ?? 0) + dt
    // A big step (a long offline chunk) can cross several spawns at once.
    while (clock >= def.secondsPerItem && live < def.cap) {
      clock -= def.secondsPerItem
      live += 1
      state.loose.seq += 1
      state.loose.items.push({ id: state.loose.seq, zone: def.zone, item: def.item, amount: def.amount })
    }
    state.loose.clocks[key] = live >= def.cap ? def.secondsPerItem : clock
  }
}

/** The piece of debris with this id, or null. */
export function looseById(state: GameState, id: number): LooseItem | null {
  return state.loose.items.find((piece) => piece.id === id) ?? null
}

/** Takes a piece off the ground (its item has already gone to the bag). */
export function removeLoose(state: GameState, id: number): void {
  const index = state.loose.items.findIndex((piece) => piece.id === id)
  if (index >= 0) state.loose.items.splice(index, 1)
}
