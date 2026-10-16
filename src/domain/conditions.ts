import { Decimal } from '@core/num'
import { findBranch, findUpgrade, findWorker } from './lookup'
import type { Condition, GameContent, GameState } from './types'

/**
 * Conditions are evaluated straight from the state — no content lookups needed,
 * because every kind only reads counters that content already validated. Unknown
 * ids therefore read as "nothing owned yet" and simply fail the condition.
 */

export interface ConditionProgress {
  current: Decimal
  target: Decimal
  met: boolean
}

export function isConditionMet(state: GameState, condition: Condition): boolean {
  switch (condition.kind) {
    case 'workers':
      return (state.branches[condition.branch]?.workers[condition.worker] ?? 0) >= condition.count
    case 'upgrade':
      return state.branches[condition.branch]?.upgrades[condition.upgrade] === true
    case 'totalEarned':
      return state.stats.totalEarned.gte(condition.amount)
    case 'playTime':
      return state.stats.playTimeS >= condition.seconds
  }
}

export function conditionProgress(state: GameState, condition: Condition): ConditionProgress {
  let current: Decimal
  let target: Decimal
  switch (condition.kind) {
    case 'workers':
      current = new Decimal(state.branches[condition.branch]?.workers[condition.worker] ?? 0)
      target = new Decimal(condition.count)
      break
    case 'upgrade':
      current = new Decimal(state.branches[condition.branch]?.upgrades[condition.upgrade] === true ? 1 : 0)
      target = new Decimal(1)
      break
    case 'totalEarned':
      current = state.stats.totalEarned
      target = condition.amount
      break
    case 'playTime':
      current = new Decimal(state.stats.playTimeS)
      target = new Decimal(condition.seconds)
      break
  }
  return { current, target, met: current.gte(target) }
}

export function isZoneUnlocked(state: GameState, content: GameContent, zoneId: string): boolean {
  const zone = content.zones[zoneId]
  if (!zone) return false
  return zone.requires ? isConditionMet(state, zone.requires) : true
}

export function isBranchUnlocked(state: GameState, content: GameContent, branchId: string): boolean {
  const branch = findBranch(content, branchId)
  if (!branch) return false
  return branch.requires ? isConditionMet(state, branch.requires) : true
}

/** A worker needs its branch, its zone and its own gate all open. */
export function isWorkerUnlocked(
  state: GameState,
  content: GameContent,
  branchId: string,
  workerId: string,
): boolean {
  if (!isBranchUnlocked(state, content, branchId)) return false
  const branch = findBranch(content, branchId)
  const worker = branch ? findWorker(branch, workerId) : undefined
  if (!worker) return false
  if (!isZoneUnlocked(state, content, worker.visual.zone)) return false
  return worker.requires ? isConditionMet(state, worker.requires) : true
}

export function isUpgradeUnlocked(
  state: GameState,
  content: GameContent,
  branchId: string,
  upgradeId: string,
): boolean {
  if (!isBranchUnlocked(state, content, branchId)) return false
  const branch = findBranch(content, branchId)
  const upgrade = branch ? findUpgrade(branch, upgradeId) : undefined
  if (!upgrade) return false
  return upgrade.requires ? isConditionMet(state, upgrade.requires) : true
}
