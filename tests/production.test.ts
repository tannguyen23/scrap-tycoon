import { Decimal } from '@core/num'
import { buyUpgrade } from '@domain/commands'
import { incomePerSecond } from '@domain/selectors'
import { createFreshState, getResource } from '@domain/state'
import { applyRates } from '@domain/systems/production'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { TEST_CONTENT, branchDef, branchStateOf, expectCloseTo } from './fixtures'

describe('production system', () => {
  it('turns worker output into money through the recipe', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 2

    const deltas = applyRates(state, TEST_CONTENT, 1)

    // 2 ore/s produced, sold the same tick, 1 ore = 0.5 money.
    expectCloseTo(getResource(state, 'ore'), new Decimal(0))
    expectCloseTo(getResource(state, 'money'), new Decimal(1))
    expectCloseTo(deltas.get('money') ?? new Decimal(0), new Decimal(1))
  })

  it('applies worker and recipe modifiers', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(1000))
    branchStateOf(state, 'mine').workers['digger'] = 2
    expect(buyUpgrade(state, TEST_CONTENT, 'mine', 'boots').ok).toBe(true)
    expect(buyUpgrade(state, TEST_CONTENT, 'mine', 'gloves').ok).toBe(true)

    applyRates(state, TEST_CONTENT, 1)

    // 1000 − 50 (boots) − 200 (gloves) + 3 = 753
    expectCloseTo(getResource(state, 'money'), new Decimal(753))
  })

  it('caps finite-rate recipes and lets stock pile up', () => {
    const base = branchDef(TEST_CONTENT, 'mine')
    const content: GameContent = {
      ...TEST_CONTENT,
      branches: {
        mine: {
          ...base,
          recipes: [
            {
              id: 'slow-sell',
              name: { vi: 'Bán chậm', en: 'Slow sell' },
              input: { item: 'ore', rate: new Decimal(1) },
              output: { item: 'money', perInputUnit: new Decimal(2) },
            },
          ],
        },
      },
    }
    const state = createFreshState(content, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 5

    applyRates(state, content, 10)

    // 50 ore produced, throughput capped at 1/s over 10s.
    expectCloseTo(getResource(state, 'ore'), new Decimal(40))
    expectCloseTo(getResource(state, 'money'), new Decimal(20))
  })

  it('produces nothing for a zero-length step', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 1
    expect(applyRates(state, TEST_CONTENT, 0).size).toBe(0)
  })

  it('projects income per second for the HUD', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 2
    expectCloseTo(incomePerSecond(state, TEST_CONTENT), new Decimal(1))
  })
})
