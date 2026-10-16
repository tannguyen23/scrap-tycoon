import { D0, D1, Decimal } from '@core/num'
import { carryCapFor, itemCapFor } from './capacity'
import { isGearUnlocked } from './conditions'
import { bulkCost, maxAffordable, unitCost } from './curves'
import { findBranch, findWorker } from './lookup'
import { applyModifiers, collectModifiers, mergeModifiers } from './modifiers'
import { cloneState, getResource, getStock } from './state'
import { itemZones, zoneOfItem } from './zones'
import {
  GLOBAL_WORKER_OUTPUT,
  PLAYER_WALK_SPEED,
  PLAYER_WORK_SPEED,
  branchRecipeOutput,
  branchWorkerOutput,
  workerStepOutput,
} from './statKeys'
import { applyRates } from './systems/production'
import { weatherAt } from './weather'
import { GEAR_SLOTS } from './types'
import type { Condition, GameContent, GameState, GearDef, GearSlot, ItemId, WeatherKindDef, ZoneId } from './types'

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
  const stepMods = mergeModifiers(mods.get(branchWorkerOutput(branchId)), mods.get(workerStepOutput(branchId, workerId)))
  if (worker.input) {
    const speed = applyModifiers(D1, mergeModifiers(stepMods, global))
    const ratio = worker.output.ratePerUnit.div(worker.input.ratePerUnit)
    const value = worker.output.item === content.currencyItemId
      ? applyModifiers(D1, mods.get(branchRecipeOutput(branchId)))
      : D1
    return worker.input.ratePerUnit.mul(speed).mul(ratio).mul(value)
  }
  const outputMods = mergeModifiers(stepMods, global)
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
    mergeModifiers(
      mergeModifiers(mods.get(branchWorkerOutput(branchId)), mods.get(workerStepOutput(branchId, workerId))),
      mods.get(GLOBAL_WORKER_OUTPUT),
    ),
  )
  return worker.input.ratePerUnit.mul(speed)
}

/**
 * How full an item's stock is (0..1), or null when that item is uncapped.
 * The stock lives in the warehouse of the item's zone.
 */
export function stockRatio(state: GameState, content: GameContent, itemId: ItemId): number | null {
  const cap = itemCapFor(content, itemId, collectModifiers(state, content))
  if (!cap || cap.lte(0)) return null
  return Math.min(1, itemAmount(state, content, itemId).div(cap).toNumber())
}

/** Amount + cap of one stock, for HUD readouts (null when the item is uncapped). */
export function stockInfo(
  state: GameState,
  content: GameContent,
  itemId: ItemId,
): { amount: Decimal; cap: Decimal } | null {
  const cap = itemCapFor(content, itemId, collectModifiers(state, content))
  if (!cap || cap.lte(0)) return null
  return { amount: itemAmount(state, content, itemId), cap }
}

/** One warehouse row of a zone, for the HUD zone card. */
export interface ZoneStockRow {
  itemId: ItemId
  amount: Decimal
  /** null when the item is uncapped. */
  cap: Decimal | null
  /** 0..1 fill ratio, or null when uncapped. */
  ratio: number | null
}

/** Every stock row in a zone's warehouse (usually exactly one item). */
export function zoneStock(state: GameState, content: GameContent, zoneId: ZoneId): ZoneStockRow[] {
  const mods = collectModifiers(state, content)
  const rows: ZoneStockRow[] = []
  for (const itemId of Object.keys(state.stock[zoneId] ?? {})) {
    const amount = getStock(state, zoneId, itemId)
    const cap = itemCapFor(content, itemId, mods)
    const bounded = cap && cap.gt(0) ? cap : null
    rows.push({
      itemId,
      amount,
      cap: bounded,
      ratio: bounded ? Math.min(1, amount.div(bounded).toNumber()) : null,
    })
  }
  return rows
}

/** Amount of an item in the warehouse of its zone (falls back to the global pool). */
function itemAmount(state: GameState, content: GameContent, itemId: ItemId): Decimal {
  const zone = zoneOfItem(content, itemId)
  return zone ? getStock(state, zone, itemId) : getResource(state, itemId)
}

/** One non-empty bag slot, for the inventory panel. Empty slots stay `null`. */
export interface BagSlotRow {
  index: number
  itemId: ItemId
  amount: Decimal
  /** Per-slot stack ceiling for this item — a slot never holds more than this. */
  cap: Decimal
  /** 0..1 fill of the slot against its stack ceiling. */
  ratio: number
  /** The zone whose warehouse this item belongs to — where it can be stored. */
  zone: ZoneId | null
}

/** Every bag slot in order — `null` for an empty slot, so the grid keeps its shape. */
export function bagSlotRows(state: GameState, content: GameContent): (BagSlotRow | null)[] {
  const mods = collectModifiers(state, content)
  return state.bag.map((slot, index) => {
    if (!slot || slot.amount.lte(0)) return null
    const cap = carryCapFor(content, slot.item, mods) ?? slot.amount
    return {
      index,
      itemId: slot.item,
      amount: slot.amount,
      cap,
      ratio: cap.gt(0) ? Math.min(1, slot.amount.div(cap).toNumber()) : 1,
      zone: zoneOfItem(content, slot.item),
    }
  })
}

/** One slot of the character sheet, for the inventory panel. */
export interface GearRow {
  slot: GearSlot
  /** The piece content declares for this slot, if any. */
  gear: GearDef | null
  /** Owned = worn (one piece per slot). */
  owned: boolean
  /** Price when it is still to buy, null once owned. */
  cost: Decimal | null
  /** Gate still to clear, null when the piece is available. */
  requirement: Condition | null
}

/** Every gear slot in a fixed order, empty ones included — the sheet is a grid. */
export function gearRows(state: GameState, content: GameContent): GearRow[] {
  return GEAR_SLOTS.map((slot) => {
    const piece = (content.gear ?? []).find((entry) => entry.slot === slot) ?? null
    if (!piece) return { slot, gear: null, owned: false, cost: null, requirement: null }
    const owned = state.gear[piece.id] === true
    const unlocked = isGearUnlocked(state, content, piece.id)
    return {
      slot,
      gear: piece,
      owned,
      cost: owned ? null : piece.cost,
      requirement: owned || unlocked ? null : (piece.requires ?? null),
    }
  })
}

/** How much faster the player's hand work runs (gear, in the modifier pipeline). */
export function playerWorkSpeed(state: GameState, content: GameContent): Decimal {
  return applyModifiers(D1, collectModifiers(state, content).get(PLAYER_WORK_SPEED))
}

/** How much faster the player walks (gear, in the modifier pipeline). */
export function playerWalkSpeed(state: GameState, content: GameContent): Decimal {
  return applyModifiers(D1, collectModifiers(state, content).get(PLAYER_WALK_SPEED))
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
 * The item whose stock represents a zone on the map/HUD — the first item the
 * zone's warehouse holds (e.g. the alley pile holds `scrap` for the porters).
 */
export function zoneStockItem(content: GameContent, zoneId: ZoneId): ItemId | null {
  for (const [itemId, zone] of itemZones(content)) {
    if (zone === zoneId) return itemId
  }
  return null
}

/** Weather kind playing right now, or null when the content has no weather profile. */
export function currentWeather(content: GameContent, state: GameState): WeatherKindDef | null {
  const profile = content.weather
  if (!profile) return null
  return weatherAt(profile, state.stats.playTimeS)
}
