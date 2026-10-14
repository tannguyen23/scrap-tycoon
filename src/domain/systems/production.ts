import { D0, D1, Decimal, minDec } from '@core/num'
import { itemCapFor } from '../capacity'
import type { Modifiers } from '../modifiers'
import { applyModifiers, collectModifiers, mergeModifiers } from '../modifiers'
import { addResource, getResource } from '../state'
import { GLOBAL_WORKER_OUTPUT, branchRecipeOutput, branchWorkerOutput } from '../statKeys'
import type { GameContent, GameState, ItemId } from '../types'

export type Deltas = Map<ItemId, Decimal>

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
    const outputMods = mergeModifiers(mods.get(branchWorkerOutput(branch.id)), globalMods)
    for (const worker of branch.workers) {
      // Legs (workers with an input) are resolved in applyRates' transport pass —
      // counting them here would conjure their output out of thin air.
      if (worker.input) continue
      const count = branchState.workers[worker.id]
      if (!count || count <= 0) continue
      const rate = applyModifiers(worker.output.ratePerUnit, outputMods).mul(count)
      rates.set(worker.output.item, (rates.get(worker.output.item) ?? D0).add(rate))
    }
  }
  return rates
}

/**
 * Applies worker output, transport legs and recipe conversions over `dt` seconds
 * to the state, returning the actual item deltas. Three passes, in order:
 *   1. production — pure producers (`worker.output`), clamped by the target stock
 *      cap so a full bin stops upstream work;
 *   2. legs — workers with an `input` (transport/processing): consume upstream
 *      stock (clamped by what's available AND by downstream headroom, so goods
 *      are never destroyed), produce `input × output/input ratio`;
 *   3. recipes — conversion steps; `input.rate === null` consumes everything
 *      available, a finite rate caps throughput.
 * Everything is linear in `dt`; caps make behaviour state-dependent, which is why
 * offline chunks when content has caps (see systems/offline).
 */
export function applyRates(
  state: GameState,
  content: GameContent,
  dt: number,
  mods: Map<string, Modifiers> = collectModifiers(state, content),
): Deltas {
  const deltas: Deltas = new Map()
  const globalMods = mods.get(GLOBAL_WORKER_OUTPUT)

  const productionRates = computeProductionRates(state, content, mods)
  for (const [itemId, rate] of productionRates) {
    const want = rate.mul(dt)
    const room = headroom(state, content, itemId, mods)
    const produced = room === null ? want : minDec(want, room)
    if (produced.lte(0)) continue
    addResource(state, itemId, produced)
    addDelta(deltas, itemId, produced)
  }

  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    const speedMods = mergeModifiers(mods.get(branchWorkerOutput(branch.id)), globalMods)
    const valueMods = mods.get(branchRecipeOutput(branch.id))
    for (const worker of branch.workers) {
      const input = worker.input
      if (!input) continue
      const count = branchState.workers[worker.id]
      if (!count || count <= 0) continue

      const speed = applyModifiers(D1, speedMods)
      const wantIn = input.ratePerUnit.mul(count).mul(dt).mul(speed)
      if (wantIn.lte(0)) continue

      const ratio = worker.output.ratePerUnit.div(input.ratePerUnit)
      // Markup only scales money: a value upgrade must not conjure matter out of
      // a 1:1 transport leg.
      const value = worker.output.item === content.currencyItemId ? applyModifiers(D1, valueMods) : D1
      const roomOut = headroom(state, content, worker.output.item, mods)
      const maxByDown = roomOut === null ? wantIn : roomOut.div(ratio.mul(value))
      const available = getResource(state, input.item)
      const consumed = minDec(minDec(available, wantIn), maxByDown)
      if (consumed.lte(0)) continue

      const produced = consumed.mul(ratio).mul(value)
      addResource(state, input.item, consumed.neg())
      addResource(state, worker.output.item, produced)
      addDelta(deltas, input.item, consumed.neg())
      addDelta(deltas, worker.output.item, produced)
    }
  }

  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    const recipeMods = mods.get(branchRecipeOutput(branch.id))
    for (const recipe of branch.recipes) {
      const available = getResource(state, recipe.input.item)
      const capacity = recipe.input.rate === null ? available : recipe.input.rate.mul(dt)
      const wanted = minDec(available, capacity)
      if (wanted.lte(0)) continue

      const outputMult = applyModifiers(D1, recipeMods)
      const perInput = recipe.output.perInputUnit.mul(outputMult)
      const roomOut = headroom(state, content, recipe.output.item, mods)
      // Back-solve the input so a full output bin caps the conversion instead of
      // destroying the consumed material.
      const consumed = roomOut === null ? wanted : minDec(wanted, roomOut.div(perInput))
      if (consumed.lte(0)) continue
      const produced = consumed.mul(perInput)

      addResource(state, recipe.input.item, consumed.neg())
      addResource(state, recipe.output.item, produced)
      addDelta(deltas, recipe.input.item, consumed.neg())
      addDelta(deltas, recipe.output.item, produced)
    }
  }

  return deltas
}

/** Remaining room to the item's cap (null = uncapped), floored at zero. */
function headroom(
  state: GameState,
  content: GameContent,
  itemId: ItemId,
  mods: Map<string, Modifiers>,
): Decimal | null {
  const cap = itemCapFor(content, itemId, mods)
  if (!cap) return null
  const room = cap.sub(getResource(state, itemId))
  return room.gt(0) ? room : D0
}

function addDelta(deltas: Deltas, itemId: ItemId, amount: Decimal): void {
  if (amount.eq(0)) return
  deltas.set(itemId, (deltas.get(itemId) ?? D0).add(amount))
}
