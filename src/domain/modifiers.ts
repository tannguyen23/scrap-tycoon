import { Decimal } from '@core/num'
import type { GameContent, GameState, StatEffect } from './types'
import { milestoneEffects } from './milestones'
import { GLOBAL_WORKER_OUTPUT } from './statKeys'
import { weatherWorkMultiplier } from './weather'

export interface Modifiers {
  flat: Decimal[]
  mult: Decimal[]
  global: Decimal[]
}

export function emptyModifiers(): Modifiers {
  return { flat: [], mult: [], global: [] }
}

/** Concatenates two modifier sets — e.g. a branch's own mods + the global world mods. */
export function mergeModifiers(a: Modifiers | undefined, b: Modifiers | undefined): Modifiers | undefined {
  if (!a) return b
  if (!b) return a
  return {
    flat: [...a.flat, ...b.flat],
    mult: [...a.mult, ...b.mult],
    global: [...a.global, ...b.global],
  }
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

  // Weather is time-derived (playTimeS) rather than purchased, but it still flows
  // through the pipeline so every consumer — tick, offline, income selectors —
  // sees the same multiplier without extra plumbing.
  const weather = content.weather
  if (weather) {
    const multiplier = weatherWorkMultiplier(weather, state.stats.playTimeS)
    if (multiplier !== 1) {
      addEffect(result, { target: GLOBAL_WORKER_OUTPUT, kind: 'global', value: new Decimal(multiplier) })
    }
  }

  // Milestone rewards are derived the same way: idempotent effects while the goal
  // holds, no save flags, and every consumer sees them for free.
  for (const effect of milestoneEffects(state, content)) {
    addEffect(result, effect)
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
