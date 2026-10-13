import { Decimal } from '@core/num'
import { buyUpgrade, buyWorker } from '@domain/commands'
import { bulkCost, maxAffordable, unitCost } from '@domain/curves'
import { createFreshState, getResource } from '@domain/state'
import { describe, expect, it } from 'vitest'
import { TEST_CONTENT, branchStateOf, expectCloseTo } from './fixtures'

const BASE = new Decimal(10)
const GROWTH = new Decimal(2)

describe('cost curves', () => {
  it('unitCost follows base × growthⁿ', () => {
    expectCloseTo(unitCost(BASE, GROWTH, 0), new Decimal(10))
    expectCloseTo(unitCost(BASE, GROWTH, 3), new Decimal(80))
  })

  it('bulkCost equals the closed-form sum of the series', () => {
    expectCloseTo(bulkCost(BASE, GROWTH, 0, 3), new Decimal(70)) // 10 + 20 + 40
    expectCloseTo(bulkCost(BASE, GROWTH, 2, 2), new Decimal(120)) // 40 + 80
    expectCloseTo(bulkCost(BASE, GROWTH, 0, 0), new Decimal(0))
  })

  it('maxAffordable finds the largest count within budget', () => {
    expect(maxAffordable(BASE, GROWTH, 0, new Decimal(70))).toBe(3)
    expect(maxAffordable(BASE, GROWTH, 0, new Decimal(69))).toBe(2)
    expect(maxAffordable(BASE, GROWTH, 0, new Decimal(9))).toBe(0)
    // 10+20+40+80+160+320 = 630 ≤ 1000, next unit (640) pushes it over
    expect(maxAffordable(BASE, GROWTH, 0, new Decimal(1000))).toBe(6)
  })
})

describe('buyWorker', () => {
  it('deducts the exact bulk cost and increments the count', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(100))
    const result = buyWorker(state, TEST_CONTENT, 'mine', 'digger', 3)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expectCloseTo(result.value.cost, new Decimal(70))
      expect(result.value.bought).toBe(3)
    }
    expect(branchStateOf(state, 'mine').workers['digger']).toBe(3)
    expectCloseTo(getResource(state, 'money'), new Decimal(30))
  })

  it('buys as many as possible with the max quantity', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(70))
    const result = buyWorker(state, TEST_CONTENT, 'mine', 'digger', 'max')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.bought).toBe(3)
    expectCloseTo(getResource(state, 'money'), new Decimal(0))
  })

  it('fails without mutating when money is short', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(69))
    const result = buyWorker(state, TEST_CONTENT, 'mine', 'digger', 3)

    expect(result.ok).toBe(false)
    expect(branchStateOf(state, 'mine').workers['digger']).toBeUndefined()
    expectCloseTo(getResource(state, 'money'), new Decimal(69))
  })

  it('reports a clear reason when nothing is affordable', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(9))
    const result = buyWorker(state, TEST_CONTENT, 'mine', 'digger', 'max')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('nothing-affordable')
  })

  it('rejects unknown targets', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(100))
    expect(buyWorker(state, TEST_CONTENT, 'nope', 'digger', 1).ok).toBe(false)
    expect(buyWorker(state, TEST_CONTENT, 'mine', 'nope', 1).ok).toBe(false)
  })
})

describe('buyUpgrade', () => {
  it('charges once and marks the upgrade as purchased', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(100))

    const first = buyUpgrade(state, TEST_CONTENT, 'mine', 'boots')
    expect(first.ok).toBe(true)
    expect(branchStateOf(state, 'mine').upgrades['boots']).toBe(true)
    expectCloseTo(getResource(state, 'money'), new Decimal(50))

    const second = buyUpgrade(state, TEST_CONTENT, 'mine', 'boots')
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toBe('already-purchased')
  })

  it('fails without mutating when money is short', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(49))
    expect(buyUpgrade(state, TEST_CONTENT, 'mine', 'boots').ok).toBe(false)
    expect(branchStateOf(state, 'mine').upgrades['boots']).toBeUndefined()
  })
})
