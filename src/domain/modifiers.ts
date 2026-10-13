import type Decimal from 'break_eternity.js'
import type { GameContent, GameState, StatEffect } from './types'

export interface Modifiers {
  flat: Decimal[]
  mult: Decimal[]
  global: Decimal[]
}

export function emptyModifiers(): Modifiers {
  return { flat: [], mult: [], global: [] }
}

/**
 * The stat pipeline every number in the game flows through:
 *   final = (base + Σ flat) × Π mult × Π global
 * Upgrades, prestige bonuses and branch perks are pure data feeding this.
 */
export function applyModifiers(base: Decimal, mods: Modifiers | undefined): Decimal {
  if (!mods) return base
  let value = base
  for (const flat of mods.flat) value = value.add(flat)
  for (const mult of mods.mult) value = value.mul(mult)
  for (const global of mods.global) value = value.mul(global)
  return value
}

/** Aggregates every purchased upgrade effect into per-target modifier sets. */
export function collectModifiers(state: GameState, content: GameContent): Map<string, Modifiers> {
  const result = new Map<string, Modifiers>()
  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    for (const upgrade of branch.upgrades) {
      if (!branchState.upgrades[upgrade.id]) continue
      for (const effect of upgrade.effects) {
        addEffect(result, effect)
      }
    }
  }
  return result
}

function addEffect(result: Map<string, Modifiers>, effect: StatEffect): void {
  let mods = result.get(effect.target)
  if (!mods) {
    mods = emptyModifiers()
    result.set(effect.target, mods)
  }
  mods[effect.kind].push(effect.value)
}
