import type { BranchId, ItemId } from './types'

/**
 * Stat key conventions — every upgrade/prestige/branch bonus targets these keys,
 * and systems resolve stats through the modifier pipeline instead of hardcoding
 * coefficients.
 */
export function branchWorkerOutput(branchId: BranchId): string {
  return `branch.${branchId}.workerOutput`
}

export function branchRecipeOutput(branchId: BranchId): string {
  return `branch.${branchId}.recipeOutput`
}

/** Global multiplier over every worker's output (weather, world events). */
export const GLOBAL_WORKER_OUTPUT = 'global.workerOutput'

/** Capacity multiplier for one item's stock ceiling (bin expansions). */
export function itemCapacity(itemId: ItemId): string {
  return `item.${itemId}.capacity`
}
