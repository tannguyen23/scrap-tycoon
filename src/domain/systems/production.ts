import { D0, D1, Decimal, minDec } from '@core/num'
import type { Modifiers } from '../modifiers'
import { applyModifiers, collectModifiers } from '../modifiers'
import { addResource, getResource } from '../state'
import { branchRecipeOutput, branchWorkerOutput } from '../statKeys'
import type { GameContent, GameState, ItemId } from '../types'

export type Deltas = Map<ItemId, Decimal>

/** Worker output per item, per second, after modifiers. */
export function computeProductionRates(
  state: GameState,
  content: GameContent,
  mods: Map<string, Modifiers> = collectModifiers(state, content),
): Map<ItemId, Decimal> {
  const rates = new Map<ItemId, Decimal>()
  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    const outputMods = mods.get(branchWorkerOutput(branch.id))
    for (const worker of branch.workers) {
      const count = branchState.workers[worker.id]
      if (!count || count <= 0) continue
      const rate = applyModifiers(worker.output.ratePerUnit, outputMods).mul(count)
      rates.set(worker.output.item, (rates.get(worker.output.item) ?? D0).add(rate))
    }
  }
  return rates
}

/**
 * Applies worker output and recipe conversions over `dt` seconds to the state,
 * returning the actual item deltas. Recipes run after production, in content
 * order:
 *   - `input.rate === null` consumes everything available (e.g. auto-sell)
 *   - a finite rate caps throughput, so stock can pile up
 * Linear in `dt`, which keeps the offline integration exact (see systems/offline).
 */
export function applyRates(
  state: GameState,
  content: GameContent,
  dt: number,
  mods: Map<string, Modifiers> = collectModifiers(state, content),
): Deltas {
  const deltas: Deltas = new Map()

  const productionRates = computeProductionRates(state, content, mods)
  for (const [itemId, rate] of productionRates) {
    const produced = rate.mul(dt)
    addResource(state, itemId, produced)
    addDelta(deltas, itemId, produced)
  }

  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    const recipeMods = mods.get(branchRecipeOutput(branch.id))
    for (const recipe of branch.recipes) {
      const available = getResource(state, recipe.input.item)
      const capacity = recipe.input.rate === null ? available : recipe.input.rate.mul(dt)
      const consumed = minDec(available, capacity)
      if (consumed.lte(0)) continue

      const outputMult = applyModifiers(D1, recipeMods)
      const produced = consumed.mul(recipe.output.perInputUnit).mul(outputMult)

      addResource(state, recipe.input.item, consumed.neg())
      addResource(state, recipe.output.item, produced)
      addDelta(deltas, recipe.input.item, consumed.neg())
      addDelta(deltas, recipe.output.item, produced)
    }
  }

  return deltas
}

function addDelta(deltas: Deltas, itemId: ItemId, amount: Decimal): void {
  if (amount.eq(0)) return
  deltas.set(itemId, (deltas.get(itemId) ?? D0).add(amount))
}
