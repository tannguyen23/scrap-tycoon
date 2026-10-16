import { D0 } from '@core/num'
import { looseSpawnTick } from './loose'
import { collectModifiers } from './modifiers'
import { applyRates } from './systems/production'
import type { GameContent, GameState } from './types'

/** One fixed simulation step: modifiers → production → recipes → litter → stats. */
export function runTick(state: GameState, content: GameContent, dt: number): void {
  const mods = collectModifiers(state, content)
  const deltas = applyRates(state, content, dt, mods)

  // Debris on the yard floors accumulates on the same clock (transient — never saved).
  looseSpawnTick(state, content, dt)

  const earned = deltas.get(content.currencyItemId) ?? D0
  if (earned.gt(0)) {
    state.stats.totalEarned = state.stats.totalEarned.add(earned)
  }
  state.stats.playTimeS += dt
}
