import { Decimal } from '@core/num'
import {
  completedMilestoneIds,
  isMilestoneDone,
  milestoneEffects,
  milestoneStatus,
  newlyCompletedMilestones,
} from '@domain/milestones'
import { applyModifiers, collectModifiers } from '@domain/modifiers'
import { createFreshState } from '@domain/state'
import { branchRecipeOutput, branchWorkerOutput } from '@domain/statKeys'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { TEST_CONTENT } from './fixtures'

const MILESTONE_CONTENT: GameContent = {
  ...TEST_CONTENT,
  milestones: [
    {
      id: 'dig-five',
      name: { vi: 'Năm thợ đào', en: 'Five diggers' },
      desc: { vi: 'Có 5 thợ đào.', en: 'Own 5 diggers.' },
      requires: { kind: 'workers', branch: 'mine', worker: 'digger', count: 5 },
      reward: [{ target: branchWorkerOutput('mine'), kind: 'mult', value: new Decimal(2) }],
    },
    {
      id: 'earn-hundred',
      name: { vi: 'Trăm đầu tiên', en: 'First hundred' },
      desc: { vi: 'Kiếm tổng 100 đồng.', en: 'Earn 100 coins in total.' },
      requires: { kind: 'totalEarned', amount: new Decimal(100) },
      reward: [{ target: branchRecipeOutput('mine'), kind: 'mult', value: new Decimal('1.5') }],
    },
  ],
}

function reachBoth(state: ReturnType<typeof createFreshState>): void {
  const branchState = state.branches['mine']
  if (!branchState) throw new Error('fresh state is missing the mine branch')
  branchState.workers['digger'] = 5
  state.stats.totalEarned = new Decimal(120)
}

describe('milestone derivation', () => {
  it('reports status and progress from the live state', () => {
    const state = createFreshState(MILESTONE_CONTENT, new Decimal(10))
    const fresh = milestoneStatus(state, MILESTONE_CONTENT)
    expect(fresh.map((row) => row.done)).toEqual([false, false])
    expect(fresh[0]?.progress.current.toString()).toBe('0')
    expect(fresh[0]?.progress.target.toString()).toBe('5')

    reachBoth(state)
    const reached = milestoneStatus(state, MILESTONE_CONTENT)
    expect(reached.map((row) => row.done)).toEqual([true, true])
    expect(completedMilestoneIds(state, MILESTONE_CONTENT)).toEqual(new Set(['dig-five', 'earn-hundred']))
  })

  it('never un-reaches a milestone as the state grows', () => {
    const state = createFreshState(MILESTONE_CONTENT, new Decimal(10))
    const milestone = MILESTONE_CONTENT.milestones?.[0]
    if (!milestone) throw new Error('fixture lost its milestones')
    expect(isMilestoneDone(state, milestone)).toBe(false)

    reachBoth(state)
    expect(isMilestoneDone(state, milestone)).toBe(true)
    const branchState = state.branches['mine']
    if (!branchState) throw new Error('missing branch state')
    branchState.workers['digger'] = 40
    state.stats.totalEarned = new Decimal(1_000_000)
    expect(isMilestoneDone(state, milestone)).toBe(true)
  })

  it('feeds reached rewards through the modifier pipeline exactly once', () => {
    const state = createFreshState(MILESTONE_CONTENT, new Decimal(10))
    expect(milestoneEffects(state, MILESTONE_CONTENT)).toEqual([])
    expect(collectModifiers(state, MILESTONE_CONTENT).has(branchWorkerOutput('mine'))).toBe(false)

    reachBoth(state)
    const mods = collectModifiers(state, MILESTONE_CONTENT)
    expect(applyModifiers(new Decimal(1), mods.get(branchWorkerOutput('mine'))).toString()).toBe('2')
    expect(applyModifiers(new Decimal(1), mods.get(branchRecipeOutput('mine'))).toString()).toBe('1.5')
  })

  it('reports only milestones that were not known before', () => {
    const state = createFreshState(MILESTONE_CONTENT, new Decimal(10))
    expect(newlyCompletedMilestones(new Set(), state, MILESTONE_CONTENT)).toEqual([])

    reachBoth(state)
    const fresh = newlyCompletedMilestones(new Set(), state, MILESTONE_CONTENT).map((m) => m.id)
    expect(fresh).toEqual(['dig-five', 'earn-hundred'])

    const late = newlyCompletedMilestones(new Set(['dig-five']), state, MILESTONE_CONTENT).map((m) => m.id)
    expect(late).toEqual(['earn-hundred'])
    expect(newlyCompletedMilestones(new Set(['dig-five', 'earn-hundred']), state, MILESTONE_CONTENT)).toEqual([])
  })

  it('handles content without milestones', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(10))
    expect(milestoneStatus(state, TEST_CONTENT)).toEqual([])
    expect(completedMilestoneIds(state, TEST_CONTENT).size).toBe(0)
  })
})
