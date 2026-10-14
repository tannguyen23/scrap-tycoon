import { Decimal } from '@core/num'
import { buyUpgrade } from '@domain/commands'
import { zoneTiers } from '@domain/selectors'
import { createFreshState } from '@domain/state'
import { describe, expect, it } from 'vitest'
import { TEST_CONTENT } from './fixtures'

describe('zoneTiers', () => {
  it('stays empty until a visual upgrade is owned', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(1e9))
    expect(zoneTiers(TEST_CONTENT, state).size).toBe(0)
  })

  it('raises the zone tier from owned upgrades and never lowers it', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(1e9))
    expect(buyUpgrade(state, TEST_CONTENT, 'mine', 'rail').ok).toBe(true)
    expect(zoneTiers(TEST_CONTENT, state).get('mine')).toBe(2)

    // Owning the lower tier afterwards must not drag the fleet back down.
    expect(buyUpgrade(state, TEST_CONTENT, 'mine', 'lift').ok).toBe(true)
    expect(zoneTiers(TEST_CONTENT, state).get('mine')).toBe(2)
  })

  it('ignores upgrades without a visual payload', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(1e9))
    expect(buyUpgrade(state, TEST_CONTENT, 'mine', 'boots').ok).toBe(true)
    expect(zoneTiers(TEST_CONTENT, state).get('mine')).toBeUndefined()
  })
})
