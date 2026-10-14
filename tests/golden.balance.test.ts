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
 * Golden balance test — locks the logistics-chain economy baseline.
 *
 * Re-locked when the game switched from "workers produce scrap + auto-sell" to
 * the 6-step chain (pick → porter → forge → cart → pack → export) with stock
 * caps and per-step surplus sale channels: the tiers list, the pace bounds and
 * the earned envelope below are the deliberate new baseline. Simulated player:
 * rushes one unit of each step in chain order, saving up instead of spamming the
 * cheapest tier. When tuning balance, change the numbers in `src/content` and
 * update the envelope here deliberately, never casually.
 */
describe('golden balance (first 10 minutes)', () => {
  it('reaches every step of the chain at the expected pace', () => {
    const state = createFreshState(GAME_CONTENT, BALANCE.startMoney)
    const tiers = ['scavenger', 'porter', 'smelter', 'cart', 'depot', 'truck']
    let nextTier = 0
    let porterBoughtAtSecond: number | null = null
    let truckBoughtAtSecond: number | null = null

    for (let second = 0; second < 600; second++) {
      const tier = tiers[nextTier]
      if (tier) {
        const result = buyWorker(state, GAME_CONTENT, BRANCH, tier, 1)
        if (result.ok) {
          if (tier === 'porter') porterBoughtAtSecond = second
          if (tier === 'truck') truckBoughtAtSecond = second
          nextTier += 1
        }
      }
      runTick(state, GAME_CONTENT, 1)
    }

    expect(workerCount(state, BRANCH, 'scavenger')).toBe(1)
    expect(workerCount(state, BRANCH, 'porter')).toBe(1)
    expect(workerCount(state, BRANCH, 'smelter')).toBe(1)
    expect(workerCount(state, BRANCH, 'cart')).toBe(1)
    expect(workerCount(state, BRANCH, 'depot')).toBe(1)
    expect(workerCount(state, BRANCH, 'truck')).toBe(1)

    // The first transport leg (porter, 30 coins) must be reachable within a minute…
    expect(porterBoughtAtSecond).not.toBeNull()
    expect(porterBoughtAtSecond ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(60)
    // …and the whole chain — export trucks included — must come online in-window.
    expect(truckBoughtAtSecond).not.toBeNull()
    expect(truckBoughtAtSecond ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(600)

    // Total earned after 10 minutes sits inside the locked baseline envelope (±20%).
    const baseline = new Decimal(90_000)
    const ratio = state.stats.totalEarned.div(baseline)
    expect(ratio.gte('0.8')).toBe(true)
    expect(ratio.lte('1.2')).toBe(true)
  })
})
