import { D0, Decimal } from '@core/num'
import { collectModifiers } from '../modifiers'
import type { GameContent, GameState } from '../types'
import { applyRates } from './production'

export interface OfflineReport {
  /** Seconds actually simulated after clamping to the cap. */
  effectiveSeconds: number
  /** Seconds the player was away, uncapped. */
  elapsedSeconds: number
  /** Currency earned while away. */
  earned: Decimal
}

/**
 * Integrates production/recipes across an absence. While away, rates are
 * constant and every part of the pipeline is linear in time, so one big step is
 * exact — online ticks and offline catch-up share the same rate computation.
 *
 * When dynamic mid-absence mechanics arrive (auto-buy, throughput ramps),
 * switch this file to chunked simulation; this is the only place to change.
 */
export function applyOfflineProgress(
  state: GameState,
  content: GameContent,
  elapsedSeconds: number,
  capSeconds: number,
): OfflineReport {
  const effectiveSeconds = Math.min(Math.max(0, elapsedSeconds), capSeconds)
  const deltas = applyRates(state, content, effectiveSeconds, collectModifiers(state, content))
  const earned = deltas.get(content.currencyItemId) ?? D0

  if (earned.gt(0)) state.stats.totalEarned = state.stats.totalEarned.add(earned)
  state.stats.playTimeS += effectiveSeconds

  return { effectiveSeconds, elapsedSeconds, earned }
}
