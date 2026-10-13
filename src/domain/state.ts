import { D0, Decimal } from '@core/num'
import type { SerializedState } from '@core/save/schema'
import type { GameContent, GameState } from './types'

export function getResource(state: GameState, itemId: string): Decimal {
  return state.resources[itemId] ?? D0
}

export function addResource(state: GameState, itemId: string, amount: Decimal): void {
  state.resources[itemId] = getResource(state, itemId).add(amount)
}

/** Deep-enough clone for projections (UI income previews, offline math on copies). */
export function cloneState(state: GameState): GameState {
  const branches: GameState['branches'] = {}
  for (const [branchId, branchState] of Object.entries(state.branches)) {
    branches[branchId] = {
      workers: { ...branchState.workers },
      upgrades: { ...branchState.upgrades },
    }
  }
  return {
    resources: { ...state.resources },
    branches,
    stats: { ...state.stats },
  }
}

export function createFreshState(content: GameContent, startMoney: Decimal): GameState {
  const resources: GameState['resources'] = {}
  for (const itemId of Object.keys(content.items)) {
    resources[itemId] = D0
  }
  resources[content.currencyItemId] = startMoney

  const branches: GameState['branches'] = {}
  for (const branch of Object.values(content.branches)) {
    branches[branch.id] = { workers: {}, upgrades: {} }
  }

  return { resources, branches, stats: { totalEarned: D0, playTimeS: 0 } }
}

export function stateToSerialized(state: GameState): SerializedState {
  const resources: Record<string, string> = {}
  for (const [itemId, amount] of Object.entries(state.resources)) {
    resources[itemId] = amount.toString()
  }

  const branches: SerializedState['branches'] = {}
  for (const [branchId, branchState] of Object.entries(state.branches)) {
    branches[branchId] = {
      workers: { ...branchState.workers },
      upgrades: { ...branchState.upgrades },
    }
  }

  return {
    resources,
    branches,
    stats: {
      totalEarned: state.stats.totalEarned.toString(),
      playTimeS: state.stats.playTimeS,
    },
  }
}

export interface HydrateResult {
  state: GameState
  warnings: string[]
}

/**
 * Rebuilds a live state from a save. Ids that no longer exist in content are
 * pruned and missing ones are filled with defaults, so content edits never
 * break existing saves (definition ↔ instance separation).
 */
export function stateFromSerialized(
  serialized: SerializedState,
  content: GameContent,
  startMoney: Decimal,
): HydrateResult {
  const state = createFreshState(content, startMoney)
  const warnings: string[] = []

  const rawResources: Record<string, unknown> = isRecord(serialized.resources) ? serialized.resources : {}
  for (const [itemId, rawValue] of Object.entries(rawResources)) {
    if (!(itemId in content.items)) {
      warnings.push(`pruned unknown item "${itemId}"`)
      continue
    }
    const amount = parseAmount(rawValue)
    if (amount === null) {
      warnings.push(`dropped invalid amount for item "${itemId}"`)
      continue
    }
    state.resources[itemId] = amount
  }

  const rawBranches: Record<string, unknown> = isRecord(serialized.branches) ? serialized.branches : {}
  for (const branchId of Object.keys(rawBranches)) {
    if (!(branchId in content.branches)) {
      warnings.push(`pruned unknown branch "${branchId}"`)
    }
  }
  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    const rawBranch = rawBranches[branch.id]
    if (!branchState || !isRecord(rawBranch)) continue

    const rawWorkers = isRecord(rawBranch['workers']) ? rawBranch['workers'] : {}
    for (const worker of branch.workers) {
      const count = rawWorkers[worker.id]
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
        branchState.workers[worker.id] = Math.floor(count)
      }
    }

    const rawUpgrades = isRecord(rawBranch['upgrades']) ? rawBranch['upgrades'] : {}
    for (const upgrade of branch.upgrades) {
      if (rawUpgrades[upgrade.id] === true) {
        branchState.upgrades[upgrade.id] = true
      }
    }
  }

  const stats: Record<string, unknown> = isRecord(serialized.stats) ? serialized.stats : {}
  state.stats.totalEarned = parseAmount(stats['totalEarned']) ?? D0
  const playTimeS = stats['playTimeS']
  state.stats.playTimeS = typeof playTimeS === 'number' && Number.isFinite(playTimeS) && playTimeS > 0 ? playTimeS : 0

  return { state, warnings }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAmount(value: unknown): Decimal | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const parsed = new Decimal(value)
  if (parsed.isNan() || parsed.lt(0)) return null
  return parsed
}
