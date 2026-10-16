import { conditionProgress, isConditionMet, type ConditionProgress } from './conditions'
import type { GameContent, GameState, MilestoneDef, StatEffect } from './types'

/**
 * Milestones are DERIVED progression goals: no id is written to the save, the
 * reached set is recomputed from `stats`/ownership on every read. Conditions are
 * monotonic, so a reached milestone can never un-reach and rewards need no
 * "paid" flag — they simply feed the modifier pipeline while the goal holds.
 */

export function milestonesOf(content: GameContent): readonly MilestoneDef[] {
  return content.milestones ?? []
}

export function isMilestoneDone(state: GameState, milestone: MilestoneDef): boolean {
  return isConditionMet(state, milestone.requires)
}

/** Ids of every milestone whose condition currently holds. */
export function completedMilestoneIds(state: GameState, content: GameContent): Set<string> {
  const done = new Set<string>()
  for (const milestone of milestonesOf(content)) {
    if (isConditionMet(state, milestone.requires)) done.add(milestone.id)
  }
  return done
}

/** Every reward granted by currently-reached milestones — merged into `collectModifiers`. */
export function milestoneEffects(state: GameState, content: GameContent): StatEffect[] {
  const effects: StatEffect[] = []
  for (const milestone of milestonesOf(content)) {
    if (!milestone.reward) continue
    if (!isConditionMet(state, milestone.requires)) continue
    effects.push(...milestone.reward)
  }
  return effects
}

export interface MilestoneStatus {
  milestone: MilestoneDef
  done: boolean
  progress: ConditionProgress
}

/** Panel rows: every milestone with its done flag and progress. */
export function milestoneStatus(state: GameState, content: GameContent): MilestoneStatus[] {
  return milestonesOf(content).map((milestone) => ({
    milestone,
    done: isConditionMet(state, milestone.requires),
    progress: conditionProgress(state, milestone.requires),
  }))
}

/**
 * Milestones reached NOW that were not in `previous` — the pure half of the
 * engine's announcement (the engine keeps the previous set in memory only, so a
 * reload never re-announces goals that were already reached in an older session).
 */
export function newlyCompletedMilestones(
  previous: ReadonlySet<string>,
  state: GameState,
  content: GameContent,
): MilestoneDef[] {
  const fresh: MilestoneDef[] = []
  for (const milestone of milestonesOf(content)) {
    if (previous.has(milestone.id)) continue
    if (isConditionMet(state, milestone.requires)) fresh.push(milestone)
  }
  return fresh
}
