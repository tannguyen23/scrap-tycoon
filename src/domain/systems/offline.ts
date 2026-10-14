import { D0, Decimal } from '@core/num'
import { hasStockDynamics } from '../capacity'
import { collectModifiers } from '../modifiers'
import type { GameContent, GameState } from '../types'
import { secondsUntilNextBlock } from '../weather'
import { applyRates } from './production'

export interface OfflineReport {
  /** Seconds actually simulated after clamping to the cap. */
  effectiveSeconds: number
  /** Seconds the player was away, uncapped. */
  elapsedSeconds: number
  /** Currency earned while away. */
  earned: Decimal
}

/** Fallback chunk when content forgets to declare one (tests/old content). */
const DEFAULT_CHUNK_SECONDS = 1

/**
 * Integrates production/recipes across an absence.
 *
 * With plain linear content (no caps, no transport legs, no weather) one big step
 * is exact, so that path stays untouched. Anything state-dependent — stock caps,
 * worker `input` legs, the weather schedule — forces chunked simulation, cutting
 * at weather blocks and at `simulation.offlineChunkSeconds`, sampling each chunk
 * at its start exactly like an online tick. This is the declared single change
 * point for dynamic mid-absence mechanics.
 *
 * Capped offline is a controlled approximation (online ticks at 0.1s, offline
 * chunks at 1s) — bins fill/drain inside a chunk, so results converge to the
 * online path but are not bit-identical there.
 */
export function applyOfflineProgress(
  state: GameState,
  content: GameContent,
  elapsedSeconds: number,
  capSeconds: number,
): OfflineReport {
  const effectiveSeconds = Math.min(Math.max(0, elapsedSeconds), capSeconds)
  const profile = content.weather
  const dynamic = hasStockDynamics(content)
  const chunkSeconds = content.simulation?.offlineChunkSeconds ?? DEFAULT_CHUNK_SECONDS
  let earned = D0

  if (!profile && !dynamic) {
    const deltas = applyRates(state, content, effectiveSeconds, collectModifiers(state, content))
    earned = deltas.get(content.currencyItemId) ?? D0
    state.stats.playTimeS += effectiveSeconds
  } else {
    let remaining = effectiveSeconds
    while (remaining > 0) {
      let chunk = remaining
      if (dynamic) chunk = Math.min(chunk, chunkSeconds)
      if (profile) chunk = Math.min(chunk, secondsUntilNextBlock(profile, state.stats.playTimeS))
      const deltas = applyRates(state, content, chunk, collectModifiers(state, content))
      earned = earned.add(deltas.get(content.currencyItemId) ?? D0)
      state.stats.playTimeS += chunk
      remaining -= chunk
    }
  }

  if (earned.gt(0)) state.stats.totalEarned = state.stats.totalEarned.add(earned)

  return { effectiveSeconds, elapsedSeconds, earned }
}
