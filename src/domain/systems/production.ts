import { D0, D1, Decimal, minDec } from '@core/num'
import { itemCapFor } from '../capacity'
import type { Modifiers } from '../modifiers'
import { applyModifiers, collectModifiers, mergeModifiers } from '../modifiers'
import { addResource, addStock, getResource, getStock } from '../state'
import { GLOBAL_WORKER_OUTPUT, branchRecipeOutput, branchWorkerOutput, workerStepOutput } from '../statKeys'
import type { GameContent, GameState, ItemId, ZoneId } from '../types'
import { itemZones } from '../zones'

export type Deltas = Map<ItemId, Decimal>

type Zones = Map<ItemId, ZoneId>

/** Reads an item's stock from the warehouse of its zone (or the global pool). */
function readStock(state: GameState, zones: Zones, itemId: ItemId): Decimal {
  const zone = zones.get(itemId)
  return zone ? getStock(state, zone, itemId) : getResource(state, itemId)
}

/** Writes an item delta into the warehouse of its zone (or the global pool). */
function writeStock(state: GameState, zones: Zones, itemId: ItemId, amount: Decimal): void {
  const zone = zones.get(itemId)
  if (zone) addStock(state, zone, itemId, amount)
  else addResource(state, itemId, amount)
}

/** Worker output per item, per second, after modifiers (pure producers only). */
export function computeProductionRates(
  state: GameState,
  content: GameContent,
  mods: Map<string, Modifiers> = collectModifiers(state, content),
): Map<ItemId, Decimal> {
  const rates = new Map<ItemId, Decimal>()
  const globalMods = mods.get(GLOBAL_WORKER_OUTPUT)
  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    const branchMods = mods.get(branchWorkerOutput(branch.id))
    for (const worker of branch.workers) {
      // Legs (workers with an input) are resolved in applyRates' transport pass —
      // counting them here would conjure their output out of thin air.
      if (worker.input) continue
      const count = branchState.workers[worker.id]
      if (!count || count <= 0) continue
      const outputMods = mergeModifiers(
        mergeModifiers(branchMods, mods.get(workerStepOutput(branch.id, worker.id))),
        globalMods,
      )
      const rate = applyModifiers(worker.output.ratePerUnit, outputMods).mul(count)
      rates.set(worker.output.item, (rates.get(worker.output.item) ?? D0).add(rate))
    }
  }
  return rates
}

/**
 * Applies worker output, transport legs and recipe conversions over `dt` seconds
 * to the state, returning the actual item deltas. Three passes, in order:
 *   1. production — pure producers (`worker.output`), clamped by the target
 *      stock cap so a full bin stops upstream work;
 *   2. legs — workers with an `input` (transport/processing): consume upstream
 *      stock (clamped by what's available AND by downstream headroom, so goods
 *      are never destroyed), produce `input × output/input ratio`;
 *   3. recipes — conversion steps; `input.rate === null` consumes everything
 *      available, a finite rate caps throughput.
 * Every read/write goes through the item's zone warehouse (`domain/zones.ts`),
 * so a leg only ever draws from the bin standing in its own chain link; money
 * stays in the global pool. Everything is linear in `dt`; caps make behaviour
 * state-dependent, which is why offline chunks when content has caps (see
 * systems/offline).
 */
export function applyRates(
  state: GameState,
  content: GameContent,
  dt: number,
  mods: Map<string, Modifiers> = collectModifiers(state, content),
): Deltas {
  const deltas: Deltas = new Map()
  const globalMods = mods.get(GLOBAL_WORKER_OUTPUT)
  const zones = itemZones(content)

  const productionRates = computeProductionRates(state, content, mods)
  for (const [itemId, rate] of productionRates) {
    const want = rate.mul(dt)
    const room = headroom(state, content, zones, itemId, mods)
    const produced = room === null ? want : minDec(want, room)
    if (produced.lte(0)) continue
    writeStock(state, zones, itemId, produced)
    addDelta(deltas, itemId, produced)
  }

  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    const branchMods = mods.get(branchWorkerOutput(branch.id))
    const valueMods = mods.get(branchRecipeOutput(branch.id))
    for (const worker of branch.workers) {
      const input = worker.input
      if (!input) continue
      const count = branchState.workers[worker.id]
      if (!count || count <= 0) continue

      const speedMods = mergeModifiers(
        mergeModifiers(branchMods, mods.get(workerStepOutput(branch.id, worker.id))),
        globalMods,
      )
      const speed = applyModifiers(D1, speedMods)
      const wantIn = input.ratePerUnit.mul(count).mul(dt).mul(speed)
      if (wantIn.lte(0)) continue

      const ratio = worker.output.ratePerUnit.div(input.ratePerUnit)
      // Markup only scales money: a value upgrade must not conjure matter out of
      // a 1:1 transport leg.
      const value = worker.output.item === content.currencyItemId ? applyModifiers(D1, valueMods) : D1
      const roomOut = headroom(state, content, zones, worker.output.item, mods)
      const maxByDown = roomOut === null ? wantIn : roomOut.div(ratio.mul(value))
      const available = readStock(state, zones, input.item)
      const consumed = minDec(minDec(available, wantIn), maxByDown)
      if (consumed.lte(0)) continue

      const produced = consumed.mul(ratio).mul(value)
      writeStock(state, zones, input.item, consumed.neg())
      writeStock(state, zones, worker.output.item, produced)
      addDelta(deltas, input.item, consumed.neg())
      addDelta(deltas, worker.output.item, produced)
    }
  }

  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    const recipeMods = mods.get(branchRecipeOutput(branch.id))
    for (const recipe of branch.recipes) {
      const available = readStock(state, zones, recipe.input.item)
      const capacity = recipe.input.rate === null ? available : recipe.input.rate.mul(dt)
      const wanted = minDec(available, capacity)
      if (wanted.lte(0)) continue

      const outputMult = applyModifiers(D1, recipeMods)
      const perInput = recipe.output.perInputUnit.mul(outputMult)
      const roomOut = headroom(state, content, zones, recipe.output.item, mods)
      // Back-solve the input so a full output bin caps the conversion instead of
      // destroying the consumed material.
      const consumed = roomOut === null ? wanted : minDec(wanted, roomOut.div(perInput))
      if (consumed.lte(0)) continue
      const produced = consumed.mul(perInput)

      writeStock(state, zones, recipe.input.item, consumed.neg())
      writeStock(state, zones, recipe.output.item, produced)
      addDelta(deltas, recipe.input.item, consumed.neg())
      addDelta(deltas, recipe.output.item, produced)
    }
  }

  return deltas
}

/** Remaining room in the item's zone bin (null = uncapped), floored at zero. */
function headroom(
  state: GameState,
  content: GameContent,
  zones: Zones,
  itemId: ItemId,
  mods: Map<string, Modifiers>,
): Decimal | null {
  const cap = itemCapFor(content, itemId, mods)
  if (!cap) return null
  const room = cap.sub(readStock(state, zones, itemId))
  return room.gt(0) ? room : D0
}

function addDelta(deltas: Deltas, itemId: ItemId, amount: Decimal): void {
  if (amount.eq(0)) return
  deltas.set(itemId, (deltas.get(itemId) ?? D0).add(amount))
}
