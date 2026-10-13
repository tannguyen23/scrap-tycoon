import type { BranchId } from './types'

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
