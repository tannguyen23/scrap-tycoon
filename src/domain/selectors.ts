import { D0, Decimal } from '@core/num'
import { bulkCost, maxAffordable, unitCost } from './curves'
import { findBranch, findWorker } from './lookup'
import { applyModifiers, collectModifiers } from './modifiers'
import { cloneState, getResource } from './state'
import { branchWorkerOutput } from './statKeys'
import { applyRates } from './systems/production'
import type { GameContent, GameState } from './types'

export function workerCount(state: GameState, branchId: string, workerId: string): number {
  return state.branches[branchId]?.workers[workerId] ?? 0
}

export function isUpgradePurchased(state: GameState, branchId: string, upgradeId: string): boolean {
  return state.branches[branchId]?.upgrades[upgradeId] === true
}

export function canAfford(state: GameState, content: GameContent, cost: Decimal): boolean {
  return getResource(state, content.currencyItemId).gte(cost)
}

export function nextWorkerCost(
  state: GameState,
  content: GameContent,
  branchId: string,
  workerId: string,
): Decimal {
  const branch = findBranch(content, branchId)
  const worker = branch ? findWorker(branch, workerId) : undefined
  if (!worker) return D0
  return unitCost(worker.baseCost, worker.costGrowth, workerCount(state, branchId, workerId))
}

export interface BulkQuote {
  count: number
  cost: Decimal
}

export function workerQuote(
  state: GameState,
  content: GameContent,
  branchId: string,
  workerId: string,
  qty: number | 'max',
): BulkQuote {
  const branch = findBranch(content, branchId)
  const worker = branch ? findWorker(branch, workerId) : undefined
  if (!worker) return { count: 0, cost: D0 }

  const owned = workerCount(state, branchId, workerId)
  const money = getResource(state, content.currencyItemId)
  const count =
    qty === 'max'
      ? maxAffordable(worker.baseCost, worker.costGrowth, owned, money)
      : Math.max(0, Math.floor(qty))
  return { count, cost: bulkCost(worker.baseCost, worker.costGrowth, owned, count) }
}

/** Current income in currency per second, measured by projecting one second on a clone. */
export function incomePerSecond(state: GameState, content: GameContent): Decimal {
  const projected = cloneState(state)
  const deltas = applyRates(projected, content, 1, collectModifiers(state, content))
  return deltas.get(content.currencyItemId) ?? D0
}

/** Per-worker output rate after modifiers (for display). */
export function workerOutputPerUnit(
  state: GameState,
  content: GameContent,
  branchId: string,
  workerId: string,
): Decimal {
  const branch = findBranch(content, branchId)
  const worker = branch ? findWorker(branch, workerId) : undefined
  if (!worker) return D0
  const mods = collectModifiers(state, content).get(branchWorkerOutput(branchId))
  return applyModifiers(worker.output.ratePerUnit, mods)
}
