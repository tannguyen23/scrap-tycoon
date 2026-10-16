import type { BranchId, ItemId } from './types'

/**
 * Stat key conventions — every upgrade/prestige/branch bonus targets these keys,
 * and systems resolve stats through the modifier pipeline instead of hardcoding
 * coefficients.
 */
export function branchWorkerOutput(branchId: BranchId): string {
  return `branch.${branchId}.workerOutput`
}

/**
 * Speed of one workflow step — a single worker id inside a branch, e.g. just
 * the porters — on top of the branch-wide key.
 */
export function workerStepOutput(branchId: BranchId, workerId: string): string {
  return `branch.${branchId}.worker.${workerId}.output`
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

/** Capacity multiplier for one item in the player's bag (bigger bags). */
export function itemCarry(itemId: ItemId): string {
  return `item.${itemId}.carry`
}

/**
 * Player stats — gear is the only thing that feeds these today, so they are
 * multipliers on the base numbers the UI/scene own (walk speed, stroke time).
 * A global carry multiplier is merged where each item's ceiling is read, the same
 * way `GLOBAL_WORKER_OUTPUT` is merged at every branch key.
 */
export const GLOBAL_CARRY = 'global.carry'
export const PLAYER_WORK_SPEED = 'player.workSpeed'
export const PLAYER_WALK_SPEED = 'player.walkSpeed'
