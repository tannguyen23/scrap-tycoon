import type Decimal from 'break_eternity.js'
import { fail, ok, type Result } from '@core/result'
import { bulkCost, maxAffordable } from './curves'
import { findBranch, findUpgrade, findWorker } from './lookup'
import { getResource } from './state'
import type { GameContent, GameState } from './types'

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

  const money = getResource(state, content.currencyItemId)
  if (upgrade.cost.gt(money)) return fail('not-enough-money')

  state.resources[content.currencyItemId] = money.sub(upgrade.cost)
  branchState.upgrades[upgradeId] = true
  return ok({ cost: upgrade.cost })
}
