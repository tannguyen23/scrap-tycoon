import { D0, D1, Decimal } from '@core/num'
import { itemCapFor } from './capacity'
import { bulkCost, maxAffordable, unitCost } from './curves'
import { findBranch, findWorker } from './lookup'
import { applyModifiers, collectModifiers, mergeModifiers } from './modifiers'
import { cloneState, getResource } from './state'
import { GLOBAL_WORKER_OUTPUT, branchRecipeOutput, branchWorkerOutput } from './statKeys'
import { applyRates } from './systems/production'
import { weatherAt } from './weather'
import type { GameContent, GameState, ItemId, WeatherKindDef, ZoneId } from './types'

export function workerCount(state: GameState, branchId: string, workerId: string): number {
  return state.branches[branchId]?.workers[workerId] ?? 0
}

export function isUpgradePurchased(state: GameState, branchId: string, upgradeId: string): boolean {
  return state.branches[branchId]?.upgrades[upgradeId] === true
}

export function canAfford(state: GameState, content: GameContent, cost: Decimal): boolean {
  return getResource(state, content.currencyItemId).gte(cost)
}

/** Highest visual tier per zone among owned upgrades (zones never upgraded are absent). */
export function zoneTiers(content: GameContent, state: GameState): Map<ZoneId, number> {
  const tiers = new Map<ZoneId, number>()
  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    for (const upgrade of branch.upgrades) {
      const visual = upgrade.visual
      if (!visual || !branchState.upgrades[upgrade.id]) continue
      tiers.set(visual.zone, Math.max(tiers.get(visual.zone) ?? 0, visual.tier))
    }
  }
  return tiers
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

/**
 * Current income in currency per second, measured by projecting one second on a
 * clone. The projection goes through the same `applyRates` path as ticks, so bin
 * caps and transport legs are respected — a saturated chain reads near zero.
 */
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
  const mods = collectModifiers(state, content)
  const global = mods.get(GLOBAL_WORKER_OUTPUT)
  if (worker.input) {
    const speed = applyModifiers(D1, mergeModifiers(mods.get(branchWorkerOutput(branchId)), global))
    const ratio = worker.output.ratePerUnit.div(worker.input.ratePerUnit)
    const value = worker.output.item === content.currencyItemId
      ? applyModifiers(D1, mods.get(branchRecipeOutput(branchId)))
      : D1
    return worker.input.ratePerUnit.mul(speed).mul(ratio).mul(value)
  }
  const outputMods = mergeModifiers(mods.get(branchWorkerOutput(branchId)), global)
  return applyModifiers(worker.output.ratePerUnit, outputMods)
}

/** Per-worker consumption rate of a transport/processing leg (null for producers). */
export function workerInputPerUnit(
  state: GameState,
  content: GameContent,
  branchId: string,
  workerId: string,
): Decimal | null {
  const branch = findBranch(content, branchId)
  const worker = branch ? findWorker(branch, workerId) : undefined
  if (!worker?.input) return null
  const mods = collectModifiers(state, content)
  const speed = applyModifiers(
    D1,
    mergeModifiers(mods.get(branchWorkerOutput(branchId)), mods.get(GLOBAL_WORKER_OUTPUT)),
  )
  return worker.input.ratePerUnit.mul(speed)
}

/** How full an item's stock is (0..1), or null when that item is uncapped. */
export function stockRatio(state: GameState, content: GameContent, itemId: ItemId): number | null {
  const cap = itemCapFor(content, itemId, collectModifiers(state, content))
  if (!cap || cap.lte(0)) return null
  return Math.min(1, getResource(state, itemId).div(cap).toNumber())
}

/** Amount + cap of one stock, for HUD readouts (null when the item is uncapped). */
export function stockInfo(
  state: GameState,
  content: GameContent,
  itemId: ItemId,
): { amount: Decimal; cap: Decimal } | null {
  const cap = itemCapFor(content, itemId, collectModifiers(state, content))
  if (!cap || cap.lte(0)) return null
  return { amount: getResource(state, itemId), cap }
}

/**
 * Money per second one sale recipe adds when it is fully fed (unlimited-input
 * recipes return 0 — their rate depends on stock). Used by the HUD channel list.
 */
export function recipeOutputPerSecond(
  state: GameState,
  content: GameContent,
  branchId: string,
  recipeId: string,
): Decimal {
  const branch = findBranch(content, branchId)
  const recipe = branch?.recipes.find((candidate) => candidate.id === recipeId)
  if (!recipe || recipe.input.rate === null) return D0
  const mods = collectModifiers(state, content).get(branchRecipeOutput(branchId))
  return recipe.input.rate.mul(recipe.output.perInputUnit).mul(applyModifiers(D1, mods))
}

/**
 * The item whose stock represents a zone on the map/HUD: the input of the zone's
 * first transport/processing worker (e.g. the alley pile holds `scrap` for the
 * porters), falling back to the output of its first worker.
 */
export function zoneStockItem(content: GameContent, zoneId: ZoneId): ItemId | null {
  for (const branch of Object.values(content.branches)) {
    for (const worker of branch.workers) {
      if (worker.visual.zone === zoneId && worker.input) return worker.input.item
    }
  }
  for (const branch of Object.values(content.branches)) {
    for (const worker of branch.workers) {
      if (worker.visual.zone === zoneId) return worker.output.item
    }
  }
  return null
}

/** Weather kind playing right now, or null when the content has no weather profile. */
export function currentWeather(content: GameContent, state: GameState): WeatherKindDef | null {
  const profile = content.weather
  if (!profile) return null
  return weatherAt(profile, state.stats.playTimeS)
}
