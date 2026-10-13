import { BALANCE } from '@content/balance'
import { GAME_CONTENT } from '@content/index'
import { Decimal } from '@core/num'
import { buyWorker } from '@domain/commands'
import { workerCount } from '@domain/selectors'
import { createFreshState } from '@domain/state'
import { runTick } from '@domain/tick'
import { describe, expect, it } from 'vitest'

const BRANCH = 'scrap'

/**
 * Golden balance test — locks the Phase 1 economy baseline.
 *
 * Simulated player: rushes one worker of each tier in order, saving up instead
 * of spamming the cheapest workers. When tuning balance, change the numbers in
 * `src/content` and update the envelope here deliberately, never casually.
 */
describe('golden balance (first 10 minutes)', () => {
  it('reaches every tier at the expected pace', () => {
    const state = createFreshState(GAME_CONTENT, BALANCE.startMoney)
    const tiers = ['scavenger', 'cart', 'depot', 'truck']
    let nextTier = 0
    let cartBoughtAtSecond: number | null = null

    for (let second = 0; second < 600; second++) {
      const tier = tiers[nextTier]
      if (tier) {
        const result = buyWorker(state, GAME_CONTENT, BRANCH, tier, 1)
        if (result.ok) {
          if (tier === 'cart') cartBoughtAtSecond = second
          nextTier += 1
        }
      }
      runTick(state, GAME_CONTENT, 1)
    }

    expect(workerCount(state, BRANCH, 'scavenger')).toBe(1)
    expect(workerCount(state, BRANCH, 'cart')).toBe(1)
    expect(workerCount(state, BRANCH, 'depot')).toBe(1)
    expect(workerCount(state, BRANCH, 'truck')).toBe(1)

    // The second tier (cart, 115 coins) must be reachable within two minutes.
    expect(cartBoughtAtSecond).not.toBeNull()
    expect(cartBoughtAtSecond ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(120)

    // Total earned after 10 minutes sits inside the locked baseline envelope (±20%).
    const baseline = new Decimal(63_000)
    const ratio = state.stats.totalEarned.div(baseline)
    expect(ratio.gte('0.8')).toBe(true)
    expect(ratio.lte('1.2')).toBe(true)
  })
})
