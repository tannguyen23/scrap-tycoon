import { D0 } from '@core/num'
import { collectModifiers } from './modifiers'
import { applyRates } from './systems/production'
import type { GameContent, GameState } from './types'

/** One fixed simulation step: modifiers → production → recipes → stats. */
export function runTick(state: GameState, content: GameContent, dt: number): void {
  const mods = collectModifiers(state, content)
  const deltas = applyRates(state, content, dt, mods)

  const earned = deltas.get(content.currencyItemId) ?? D0
  if (earned.gt(0)) {
    state.stats.totalEarned = state.stats.totalEarned.add(earned)
  }
  state.stats.playTimeS += dt
}
