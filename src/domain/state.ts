import { D0, Decimal } from '@core/num'
import type { SerializedState } from '@core/save/schema'
import { bagPlaceFrom, bagTotal, emptyBag } from './bag'
import type { Modifiers } from './modifiers'
import type { GameContent, GameState, ItemId, ZoneId } from './types'
import { itemZones } from './zones'

/** Global pool: the currency and any item not tied to a zone warehouse. */
export function getResource(state: GameState, itemId: ItemId): Decimal {
  return state.resources[itemId] ?? D0
}

export function addResource(state: GameState, itemId: ItemId, amount: Decimal): void {
  state.resources[itemId] = getResource(state, itemId).add(amount)
}

/** One warehouse row: how much of `itemId` sits in `zoneId`'s stock. */
export function getStock(state: GameState, zoneId: ZoneId, itemId: ItemId): Decimal {
  return state.stock[zoneId]?.[itemId] ?? D0
}

export function addStock(state: GameState, zoneId: ZoneId, itemId: ItemId, amount: Decimal): void {
  const bucket = state.stock[zoneId] ?? (state.stock[zoneId] = {})
  bucket[itemId] = (bucket[itemId] ?? D0).add(amount)
}

/** Everything the player carries of one item, summed across the bag's slots. */
export function getBag(state: GameState, itemId: ItemId): Decimal {
  return bagTotal(state, itemId)
}

/** Deep-enough clone for projections (UI income previews, offline math on copies). */
export function cloneState(state: GameState): GameState {
  const branches: GameState['branches'] = {}
  for (const [branchId, branchState] of Object.entries(state.branches)) {
    branches[branchId] = {
      workers: { ...branchState.workers },
      upgrades: { ...branchState.upgrades },
    }
  }
  const stock: GameState['stock'] = {}
  for (const [zoneId, bucket] of Object.entries(state.stock)) {
    stock[zoneId] = { ...bucket }
  }
  return {
    resources: { ...state.resources },
    stock,
    bag: state.bag.map((slot) => (slot ? { item: slot.item, amount: slot.amount } : null)),
    gear: { ...state.gear },
    branches,
    stats: { ...state.stats },
    loose: {
      items: state.loose.items.map((piece) => ({ ...piece })),
      clocks: { ...state.loose.clocks },
      seq: state.loose.seq,
    },
  }
}

export function createFreshState(content: GameContent, startMoney: Decimal): GameState {
  const resources: GameState['resources'] = {}
  const stock: GameState['stock'] = {}
  for (const zoneId of Object.keys(content.zones)) {
    stock[zoneId] = {}
  }

  const zones = itemZones(content)
  for (const itemId of Object.keys(content.items)) {
    const zone = zones.get(itemId)
    if (zone) {
      const bucket = stock[zone] ?? (stock[zone] = {})
      bucket[itemId] = D0
    } else {
      resources[itemId] = D0
    }
  }
  resources[content.currencyItemId] = startMoney

  const branches: GameState['branches'] = {}
  for (const branch of Object.values(content.branches)) {
    branches[branch.id] = { workers: {}, upgrades: {} }
  }

  return {
    resources,
    stock,
    bag: emptyBag(content),
    gear: {},
    branches,
    stats: { totalEarned: D0, playTimeS: 0 },
    loose: { items: [], clocks: {}, seq: 0 },
  }
}

export function stateToSerialized(state: GameState): SerializedState {
  const resources: Record<string, string> = {}
  for (const [itemId, amount] of Object.entries(state.resources)) {
    resources[itemId] = amount.toString()
  }

  // Zone warehouses flatten to item ids on disk — the zone each item lives in
  // is content, not save data, so moving an item between zones can never make
  // an old save load it into the wrong bin.
  const stock: Record<string, string> = {}
  for (const bucket of Object.values(state.stock)) {
    for (const [itemId, amount] of Object.entries(bucket)) {
      stock[itemId] = amount.toString()
    }
  }

  const branches: SerializedState['branches'] = {}
  for (const [branchId, branchState] of Object.entries(state.branches)) {
    branches[branchId] = {
      workers: { ...branchState.workers },
      upgrades: { ...branchState.upgrades },
    }
  }

  // The bag keeps its shape on disk — one entry per slot, `null` for an empty one
  // — so the player's arrangement survives a reload instead of collapsing.
  const bag = state.bag.map((slot) => (slot ? { item: slot.item, amount: slot.amount.toString() } : null))

  return {
    resources,
    stock,
    bag,
    gear: { ...state.gear },
    branches,
    stats: {
      totalEarned: state.stats.totalEarned.toString(),
      playTimeS: state.stats.playTimeS,
    },
  }
}

export interface HydrateResult {
  state: GameState
  warnings: string[]
}

/**
 * Rebuilds a live state from a save. Ids that no longer exist in content are
 * pruned and missing ones are filled with defaults, so content edits never
 * break existing saves (definition ↔ instance separation). Both the flat
 * `stock` entries and legacy `resources` entries are routed by the content
 * mapping: zone items land in their zone's bucket, global items (money) stay
 * in `resources`.
 */
export function stateFromSerialized(
  serialized: SerializedState,
  content: GameContent,
  startMoney: Decimal,
): HydrateResult {
  const state = createFreshState(content, startMoney)
  const warnings: string[] = []
  const zones = itemZones(content)

  const assign = (itemId: string, rawValue: unknown): void => {
    if (!(itemId in content.items)) {
      warnings.push(`pruned unknown item "${itemId}"`)
      return
    }
    const amount = parseAmount(rawValue)
    if (amount === null) {
      warnings.push(`dropped invalid amount for item "${itemId}"`)
      return
    }
    const zone = zones.get(itemId)
    if (zone) {
      const bucket = state.stock[zone] ?? (state.stock[zone] = {})
      bucket[itemId] = amount
    } else {
      state.resources[itemId] = amount
    }
  }

  // Legacy `resources` entries first, then `stock` — a v2 save may only carry
  // the currency in `resources`, and stock wins if both somehow hold an item.
  const rawResources: Record<string, unknown> = isRecord(serialized.resources) ? serialized.resources : {}
  for (const [itemId, rawValue] of Object.entries(rawResources)) {
    assign(itemId, rawValue)
  }
  const rawStock: Record<string, unknown> = isRecord(serialized.stock) ? serialized.stock : {}
  for (const [itemId, rawValue] of Object.entries(rawStock)) {
    assign(itemId, rawValue)
  }

  // The bag reads either shape: the v5 slot list, or the older flat record of
  // item → amount (what a v4 save migrates through). Slots are rebuilt in place so
  // a saved arrangement keeps its gaps; a stack past the item's ceiling splits into
  // following slots, and anything that still does not fit is dropped with a
  // warning, never left as inert data.
  const bagMods = new Map<string, Modifiers>()
  const placeInBag = (from: number, itemId: string, amount: Decimal): void => {
    if (!(itemId in content.items)) {
      warnings.push(`pruned unknown bag item "${itemId}"`)
      return
    }
    const added = bagPlaceFrom(state, content, bagMods, from, itemId, amount)
    if (added.lt(amount)) warnings.push(`bag overflow: dropped ${amount.sub(added).toString()} of "${itemId}"`)
  }
  const rawBag: unknown = serialized.bag
  if (Array.isArray(rawBag)) {
    for (let index = 0; index < rawBag.length; index++) {
      const entry = rawBag[index]
      if (!isRecord(entry)) continue
      const itemId = entry['item']
      if (typeof itemId !== 'string') continue
      const amount = parseAmount(entry['amount'])
      if (amount === null || amount.lte(0)) continue
      placeInBag(index, itemId, amount)
    }
  } else if (isRecord(rawBag)) {
    for (const [itemId, rawValue] of Object.entries(rawBag)) {
      const amount = parseAmount(rawValue)
      if (amount === null || amount.lte(0)) {
        warnings.push(`dropped invalid bag amount for item "${itemId}"`)
        continue
      }
      placeInBag(0, itemId, amount)
    }
  }

  // Gear is a set of owned ids: keep the ones content still declares, drop the rest.
  const rawGear: Record<string, unknown> = isRecord(serialized.gear) ? serialized.gear : {}
  for (const [gearId, owned] of Object.entries(rawGear)) {
    if (owned !== true) continue
    const piece = content.gear?.find((entry) => entry.id === gearId)
    if (!piece) {
      warnings.push(`pruned unknown gear "${gearId}"`)
      continue
    }
    state.gear[gearId] = true
  }

  const rawBranches: Record<string, unknown> = isRecord(serialized.branches) ? serialized.branches : {}
  for (const branchId of Object.keys(rawBranches)) {
    if (!(branchId in content.branches)) {
      warnings.push(`pruned unknown branch "${branchId}"`)
    }
  }
  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    const rawBranch = rawBranches[branch.id]
    if (!branchState || !isRecord(rawBranch)) continue

    const rawWorkers = isRecord(rawBranch['workers']) ? rawBranch['workers'] : {}
    for (const worker of branch.workers) {
      const count = rawWorkers[worker.id]
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
        branchState.workers[worker.id] = Math.floor(count)
      }
    }

    const rawUpgrades = isRecord(rawBranch['upgrades']) ? rawBranch['upgrades'] : {}
    for (const upgrade of branch.upgrades) {
      if (rawUpgrades[upgrade.id] === true) {
        branchState.upgrades[upgrade.id] = true
      }
    }
  }

  const stats: Record<string, unknown> = isRecord(serialized.stats) ? serialized.stats : {}
  state.stats.totalEarned = parseAmount(stats['totalEarned']) ?? D0
  const playTimeS = stats['playTimeS']
  state.stats.playTimeS = typeof playTimeS === 'number' && Number.isFinite(playTimeS) && playTimeS > 0 ? playTimeS : 0

  return { state, warnings }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAmount(value: unknown): Decimal | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const parsed = new Decimal(value)
  if (parsed.isNan() || parsed.lt(0)) return null
  return parsed
}
