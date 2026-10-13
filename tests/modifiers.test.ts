import { Decimal } from '@core/num'
import { buyUpgrade } from '@domain/commands'
import { applyModifiers, collectModifiers } from '@domain/modifiers'
import { branchRecipeOutput, branchWorkerOutput } from '@domain/statKeys'
import { createFreshState } from '@domain/state'
import { describe, expect, it } from 'vitest'
import { TEST_CONTENT, expectCloseTo } from './fixtures'

describe('modifier pipeline', () => {
  it('applies flat → mult → global in order', () => {
    const mods = {
      flat: [new Decimal(1), new Decimal(2)],
      mult: [new Decimal(2)],
      global: [new Decimal(3)],
    }
    // (10 + 1 + 2) × 2 × 3 = 78
    expectCloseTo(applyModifiers(new Decimal(10), mods), new Decimal(78))
  })

  it('returns the base untouched when there are no modifiers', () => {
    expectCloseTo(applyModifiers(new Decimal(7), undefined), new Decimal(7))
  })

  it('collects effects of purchased upgrades only, keyed by stat', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(1000))
    expect(collectModifiers(state, TEST_CONTENT).size).toBe(0)

    expect(buyUpgrade(state, TEST_CONTENT, 'mine', 'boots').ok).toBe(true)
    expect(buyUpgrade(state, TEST_CONTENT, 'mine', 'gloves').ok).toBe(true)

    const mods = collectModifiers(state, TEST_CONTENT)
    const workerMods = mods.get(branchWorkerOutput('mine'))
    const recipeMods = mods.get(branchRecipeOutput('mine'))
    expect(workerMods?.mult.map((value) => value.toString())).toEqual(['2'])
    expect(recipeMods?.mult.map((value) => value.toString())).toEqual(['1.5'])
  })
})
