import { Decimal } from '@core/num'
import {
  conditionProgress,
  isBranchUnlocked,
  isConditionMet,
  isUpgradeUnlocked,
  isWorkerUnlocked,
  isZoneUnlocked,
} from '@domain/conditions'
import { createFreshState } from '@domain/state'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { TEST_CONTENT } from './fixtures'

/** TEST_CONTENT plus one gate of every flavour: zone, worker, upgrade and branch. */
function gatedContent(): GameContent {
  const branch = TEST_CONTENT.branches['mine']
  const zone = TEST_CONTENT.zones['mine']
  if (!branch || !zone) throw new Error('fixture is missing the mine branch/zone')
  return {
    ...TEST_CONTENT,
    zones: {
      mine: { ...zone, requires: { kind: 'workers', branch: 'mine', worker: 'digger', count: 2 } },
    },
    branches: {
      mine: {
        ...branch,
        requires: { kind: 'totalEarned', amount: new Decimal(50) },
        workers: branch.workers.map((worker) =>
          worker.id === 'drill'
            ? { ...worker, requires: { kind: 'totalEarned', amount: new Decimal(500) } }
            : worker,
        ),
        upgrades: branch.upgrades.map((upgrade) =>
          upgrade.id === 'rail'
            ? { ...upgrade, requires: { kind: 'upgrade', branch: 'mine', upgrade: 'lift' } }
            : upgrade,
        ),
      },
    },
  }
}

describe('condition evaluation', () => {
  it('reads every kind straight from the state', () => {
    const content = gatedContent()
    const state = createFreshState(content, new Decimal(100))

    expect(isConditionMet(state, { kind: 'workers', branch: 'mine', worker: 'digger', count: 2 })).toBe(false)
    expect(isConditionMet(state, { kind: 'upgrade', branch: 'mine', upgrade: 'lift' })).toBe(false)
    expect(isConditionMet(state, { kind: 'totalEarned', amount: new Decimal(100) })).toBe(false)
    expect(isConditionMet(state, { kind: 'playTime', seconds: 60 })).toBe(false)

    const branchState = state.branches['mine']
    if (!branchState) throw new Error('fresh state is missing the mine branch')
    branchState.workers['digger'] = 2
    branchState.upgrades['lift'] = true
    state.stats.totalEarned = new Decimal(100)
    state.stats.playTimeS = 60

    expect(isConditionMet(state, { kind: 'workers', branch: 'mine', worker: 'digger', count: 2 })).toBe(true)
    expect(isConditionMet(state, { kind: 'upgrade', branch: 'mine', upgrade: 'lift' })).toBe(true)
    expect(isConditionMet(state, { kind: 'totalEarned', amount: new Decimal(100) })).toBe(true)
    expect(isConditionMet(state, { kind: 'playTime', seconds: 60 })).toBe(true)
  })

  it('reports progress as current/target/met', () => {
    const content = gatedContent()
    const state = createFreshState(content, new Decimal(100))
    state.stats.totalEarned = new Decimal(25)

    const earned = conditionProgress(state, { kind: 'totalEarned', amount: new Decimal(100) })
    expect(earned.current.toString()).toBe('25')
    expect(earned.target.toString()).toBe('100')
    expect(earned.met).toBe(false)

    const upgrade = conditionProgress(state, { kind: 'upgrade', branch: 'mine', upgrade: 'lift' })
    expect(upgrade.current.toString()).toBe('0')
    expect(upgrade.target.toString()).toBe('1')
    expect(upgrade.met).toBe(false)

    const workers = conditionProgress(state, { kind: 'workers', branch: 'mine', worker: 'ghost', count: 3 })
    expect(workers.current.toString()).toBe('0')
    expect(workers.met).toBe(false)
  })

  it('gates zones, workers and upgrades on their conditions', () => {
    const content = gatedContent()
    const state = createFreshState(content, new Decimal(1000))

    expect(isZoneUnlocked(state, content, 'mine')).toBe(false)
    expect(isBranchUnlocked(state, content, 'mine')).toBe(false)
    expect(isWorkerUnlocked(state, content, 'mine', 'digger')).toBe(false)
    expect(isUpgradeUnlocked(state, content, 'mine', 'rail')).toBe(false)

    // Total earned alone opens the branch but not the zone.
    state.stats.totalEarned = new Decimal(50)
    expect(isBranchUnlocked(state, content, 'mine')).toBe(true)
    expect(isZoneUnlocked(state, content, 'mine')).toBe(false)

    const branchState = state.branches['mine']
    if (!branchState) throw new Error('fresh state is missing the mine branch')
    branchState.workers['digger'] = 2
    expect(isZoneUnlocked(state, content, 'mine')).toBe(true)
    // The drill still has its own gate on top of the zone.
    expect(isWorkerUnlocked(state, content, 'mine', 'drill')).toBe(false)
    state.stats.totalEarned = new Decimal(500)
    expect(isWorkerUnlocked(state, content, 'mine', 'drill')).toBe(true)

    // Rail waits for the lift upgrade.
    expect(isUpgradeUnlocked(state, content, 'mine', 'rail')).toBe(false)
    branchState.upgrades['lift'] = true
    expect(isUpgradeUnlocked(state, content, 'mine', 'rail')).toBe(true)
  })

  it('treats unknown ids as locked', () => {
    const content = gatedContent()
    const state = createFreshState(content, new Decimal(1000))
    expect(isZoneUnlocked(state, content, 'ghost-zone')).toBe(false)
    expect(isWorkerUnlocked(state, content, 'mine', 'ghost-worker')).toBe(false)
    expect(isUpgradeUnlocked(state, content, 'mine', 'ghost-upgrade')).toBe(false)
    expect(isBranchUnlocked(state, content, 'ghost-branch')).toBe(false)
    expect(isConditionMet(state, { kind: 'workers', branch: 'ghost', worker: 'w', count: 1 })).toBe(false)
  })
})
