import type Decimal from 'break_eternity.js'
import { fail, ok, type Result } from '@core/result'
import { itemCapFor } from './capacity'
import { isConditionMet, isUpgradeUnlocked, isWorkerUnlocked, isZoneUnlocked } from './conditions'
import { bulkCost, maxAffordable } from './curves'
import { findBranch, findUpgrade, findWorker } from './lookup'
import { collectModifiers } from './modifiers'
import { addResource, addStock, getResource, getStock } from './state'
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
 * this lives in the save (no migration) and the simulation never sees it.
 *
 * Like every command, nothing is written until all four checks pass: the job
 * exists, its yard is open, the input bin can pay, and the output bin has room.
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
  const held = (item: ItemId): Decimal => {
    const zone = zoneOfItem(content, item)
    return zone ? getStock(state, zone, item) : getResource(state, item)
  }
  const store = (item: ItemId, amount: Decimal): void => {
    const zone = zoneOfItem(content, item)
    if (zone) addStock(state, zone, item, amount)
    else addResource(state, item, amount)
  }

  if (action.input && held(action.input.item).lt(action.input.amount)) return fail('no-input')
  const cap = itemCapFor(content, action.output.item, collectModifiers(state, content))
  if (cap && held(action.output.item).add(action.output.amount).gt(cap)) return fail('zone-full')

  if (action.input) store(action.input.item, action.input.amount.neg())
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
