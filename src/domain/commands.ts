import type Decimal from 'break_eternity.js'
import { fail, ok, type Result } from '@core/result'
import { carryCapFor, itemCapFor } from './capacity'
import { isConditionMet, isGearUnlocked, isUpgradeUnlocked, isWorkerUnlocked, isZoneUnlocked } from './conditions'
import { bulkCost, maxAffordable } from './curves'
import { findBranch, findUpgrade, findWorker } from './lookup'
import { collectModifiers } from './modifiers'
import { addBag, addResource, addStock, getBag, getResource, getStock } from './state'
import type { GameContent, GameState, ItemId } from './types'
import { zoneOfItem } from './zones'

export interface BuyWorkerValue {
  cost: Decimal
  bought: number
}

/** Buys `qty` workers (`'max'` buys as many as the current money allows). */
export function buyWorker(
  state: GameState,
  content: GameContent,
  branchId: string,
  workerId: string,
  qty: number | 'max',
): Result<BuyWorkerValue> {
  const branch = findBranch(content, branchId)
  if (!branch) return fail('unknown-branch')
  const worker = findWorker(branch, workerId)
  if (!worker) return fail('unknown-worker')
  const branchState = state.branches[branchId]
  if (!branchState) return fail('unknown-branch-state')
  if (!isWorkerUnlocked(state, content, branchId, workerId)) return fail('locked')

  const owned = branchState.workers[workerId] ?? 0
  const money = getResource(state, content.currencyItemId)
  const count =
    qty === 'max'
      ? maxAffordable(worker.baseCost, worker.costGrowth, owned, money)
      : Math.max(0, Math.floor(qty))
  if (count <= 0) return fail('nothing-affordable')

  const cost = bulkCost(worker.baseCost, worker.costGrowth, owned, count)
  if (cost.gt(money)) return fail('not-enough-money')

  state.resources[content.currencyItemId] = money.sub(cost)
  branchState.workers[workerId] = owned + count
  return ok({ cost, bought: count })
}

export interface BuyUpgradeValue {
  cost: Decimal
}

/** Buys a one-time upgrade. */
export function buyUpgrade(
  state: GameState,
  content: GameContent,
  branchId: string,
  upgradeId: string,
): Result<BuyUpgradeValue> {
  const branch = findBranch(content, branchId)
  if (!branch) return fail('unknown-branch')
  const upgrade = findUpgrade(branch, upgradeId)
  if (!upgrade) return fail('unknown-upgrade')
  const branchState = state.branches[branchId]
  if (!branchState) return fail('unknown-branch-state')
  if (branchState.upgrades[upgradeId]) return fail('already-purchased')
  if (!isUpgradeUnlocked(state, content, branchId, upgradeId)) return fail('locked')

  const money = getResource(state, content.currencyItemId)
  if (upgrade.cost.gt(money)) return fail('not-enough-money')

  state.resources[content.currencyItemId] = money.sub(upgrade.cost)
  branchState.upgrades[upgradeId] = true
  return ok({ cost: upgrade.cost })
}

export interface PerformActionValue {
  actionId: string
  output: { item: ItemId; amount: Decimal }
  consumed: { item: ItemId; amount: Decimal } | null
}

/**
 * One stroke of hand work. The player holds the key; when the stroke fills, the
 * chain receives exactly what one worker-second of that step would give, tuned in
 * content. It is an EVENT, not a rate: the HUD owns the timer, so nothing about
 * the stroke itself lives in the save and the simulation never sees it.
 *
 * What the stroke produces goes into the player's BAG (that is the survival
 * loop: gather, then carry it to the warehouse) and the input is spent from the
 * bag first, then from the owning zone's bin. Like every command, nothing is
 * written until every check passes: the job exists, its yard is open, the input
 * can pay, and the bag has room for the output.
 */
export function performAction(
  state: GameState,
  content: GameContent,
  actionId: string,
): Result<PerformActionValue> {
  const action = content.actions?.find((entry) => entry.id === actionId)
  if (!action) return fail('unknown-action')
  if (!isZoneUnlocked(state, content, action.zone)) return fail('locked')
  if (action.requires && !isConditionMet(state, action.requires)) return fail('locked')

  // Every item lives in the warehouse of the yard that consumes it — money stays
  // in the global pool (`domain/zones.ts` is the single source for that).
  const inBin = (item: ItemId): Decimal => {
    const zone = zoneOfItem(content, item)
    return zone ? getStock(state, zone, item) : getResource(state, item)
  }
  const storeInBin = (item: ItemId, amount: Decimal): void => {
    const zone = zoneOfItem(content, item)
    if (zone) addStock(state, zone, item, amount)
    else addResource(state, item, amount)
  }
  // Output: zone items land in the bag, global items (money) in the pool.
  const store = (item: ItemId, amount: Decimal): void => {
    if (zoneOfItem(content, item)) addBag(state, item, amount)
    else addResource(state, item, amount)
  }

  if (action.input) {
    const available = getBag(state, action.input.item).add(inBin(action.input.item))
    if (available.lt(action.input.amount)) return fail('no-input')
  }
  const carry = carryCapFor(content, action.output.item, collectModifiers(state, content))
  if (carry && getBag(state, action.output.item).add(action.output.amount).gt(carry)) return fail('bag-full')

  if (action.input) {
    // Spend what is already in the bag first — that is the loot the player just
    // gathered — and only then dip into the warehouse.
    const carried = getBag(state, action.input.item)
    const fromBag = carried.lt(action.input.amount) ? carried : action.input.amount
    if (fromBag.gt(0)) addBag(state, action.input.item, fromBag.neg())
    const rest = action.input.amount.sub(fromBag)
    if (rest.gt(0)) storeInBin(action.input.item, rest.neg())
  }
  store(action.output.item, action.output.amount)
  if (action.output.item === content.currencyItemId) {
    state.stats.totalEarned = state.stats.totalEarned.add(action.output.amount)
  }
  return ok({
    actionId: action.id,
    output: { item: action.output.item, amount: action.output.amount },
    consumed: action.input ? { item: action.input.item, amount: action.input.amount } : null,
  })
}

export interface BuyGearValue {
  cost: Decimal
}

/**
 * Buys one piece of gear. Owning it is wearing it (content keeps one piece per
 * slot), so this is the only command gear needs — and like every command nothing
 * is written until all four checks pass.
 */
export function buyGear(state: GameState, content: GameContent, gearId: string): Result<BuyGearValue> {
  const piece = content.gear?.find((entry) => entry.id === gearId)
  if (!piece) return fail('unknown-gear')
  if (state.gear[gearId]) return fail('already-owned')
  if (!isGearUnlocked(state, content, gearId)) return fail('locked')

  const money = getResource(state, content.currencyItemId)
  if (piece.cost.gt(money)) return fail('not-enough-money')

  state.resources[content.currencyItemId] = money.sub(piece.cost)
  state.gear[gearId] = true
  return ok({ cost: piece.cost })
}

export interface BagMoveValue {
  item: ItemId
  moved: Decimal
}

/**
 * Both bag moves only touch the warehouse of the zone the player is standing in,
 * and only the item that warehouse holds (`zoneOfItem`): an item dropped into a
 * bin that does not own it is inert data no pass ever reads back. Returns the
 * failure reason, or null when the move may go ahead.
 */
function bagMoveGuard(state: GameState, content: GameContent, zoneId: string, itemId: ItemId): string | null {
  if (!(zoneId in content.zones)) return 'unknown-zone'
  if (!(itemId in content.items)) return 'unknown-item'
  if (!isZoneUnlocked(state, content, zoneId)) return 'locked'
  if (zoneOfItem(content, itemId) !== zoneId) return 'wrong-zone'
  return null
}

/** Picks goods up from the warehouse of the yard the player stands in — as much as fits. */
export function takeToBag(
  state: GameState,
  content: GameContent,
  zoneId: string,
  itemId: ItemId,
): Result<BagMoveValue> {
  const bad = bagMoveGuard(state, content, zoneId, itemId)
  if (bad) return fail(bad)

  const stored = getStock(state, zoneId, itemId)
  if (stored.lte(0)) return fail('no-stock')
  const carry = carryCapFor(content, itemId, collectModifiers(state, content))
  const room = carry ? carry.sub(getBag(state, itemId)) : stored
  if (room.lte(0)) return fail('bag-full')

  const moved = stored.lt(room) ? stored : room
  addStock(state, zoneId, itemId, moved.neg())
  addBag(state, itemId, moved)
  return ok({ item: itemId, moved })
}

/** Stores carried goods into the warehouse of the yard the player stands in — as much as fits. */
export function putFromBag(
  state: GameState,
  content: GameContent,
  zoneId: string,
  itemId: ItemId,
): Result<BagMoveValue> {
  const bad = bagMoveGuard(state, content, zoneId, itemId)
  if (bad) return fail(bad)

  const carried = getBag(state, itemId)
  if (carried.lte(0)) return fail('empty-bag')
  const cap = itemCapFor(content, itemId, collectModifiers(state, content))
  const room = cap ? cap.sub(getStock(state, zoneId, itemId)) : carried
  if (room.lte(0)) return fail('zone-full')

  const moved = carried.lt(room) ? carried : room
  addBag(state, itemId, moved.neg())
  addStock(state, zoneId, itemId, moved)
  return ok({ item: itemId, moved })
}
