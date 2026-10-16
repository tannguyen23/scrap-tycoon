import { Decimal } from '@core/num'
import { performAction } from '@domain/commands'
import { createFreshState, getResource, getStock } from '@domain/state'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { expectCloseTo } from './fixtures'

/**
 * Hand work, end to end on a chain-shaped fixture:
 *   digger (mine) → ore bin (cap 10) → hauler (mine) → bar bin (yard) → packer (yard)
 * `bar` lives in the yard because that is the yard that consumes it — the same
 * rule the real content follows for sacks and billets.
 */
const CONTENT: GameContent = {
  currencyItemId: 'money',
  items: {
    money: { id: 'money', name: { vi: 'Tiền', en: 'Coins' } },
    ore: { id: 'ore', name: { vi: 'Quặng', en: 'Ore' }, cap: new Decimal(10) },
    bar: { id: 'bar', name: { vi: 'Thỏi', en: 'Bars' } },
    crate: { id: 'crate', name: { vi: 'Kiện', en: 'Crates' } },
  },
  zones: {
    mine: { id: 'mine', name: { vi: 'Mỏ', en: 'Mine' }, actionDesc: { vi: 'Đào.', en: 'Dig.' } },
    yard: {
      id: 'yard',
      name: { vi: 'Bãi', en: 'Yard' },
      actionDesc: { vi: 'Đóng kiện.', en: 'Packing.' },
      requires: { kind: 'workers', branch: 'mine', worker: 'digger', count: 1 },
    },
  },
  branches: {
    mine: {
      id: 'mine',
      name: { vi: 'Mỏ', en: 'Mine' },
      workers: [
        {
          id: 'digger',
          name: { vi: 'Thợ đào', en: 'Digger' },
          baseCost: new Decimal(10),
          costGrowth: new Decimal(2),
          output: { item: 'ore', ratePerUnit: new Decimal(1) },
          visual: { zone: 'mine', action: 'pick' },
        },
        {
          id: 'hauler',
          name: { vi: 'Người vác', en: 'Hauler' },
          baseCost: new Decimal(50),
          costGrowth: new Decimal(2),
          input: { item: 'ore', ratePerUnit: new Decimal(2) },
          output: { item: 'bar', ratePerUnit: new Decimal(2) },
          visual: { zone: 'mine', action: 'haul' },
        },
      ],
      recipes: [],
      upgrades: [],
    },
    yard: {
      id: 'yard',
      name: { vi: 'Bãi', en: 'Yard' },
      workers: [
        {
          id: 'packer',
          name: { vi: 'Thợ đóng', en: 'Packer' },
          baseCost: new Decimal(500),
          costGrowth: new Decimal(2),
          input: { item: 'bar', ratePerUnit: new Decimal(1) },
          output: { item: 'crate', ratePerUnit: new Decimal(1) },
          visual: { zone: 'yard', action: 'work' },
        },
      ],
      recipes: [],
      upgrades: [],
    },
  },
  actions: [
    {
      id: 'strip-ore',
      name: { vi: 'Đào tay', en: 'Strip ore' },
      desc: { vi: 'Đào tay.', en: 'Dig by hand.' },
      zone: 'mine',
      pose: 'poke',
      workSeconds: 1,
      output: { item: 'ore', amount: new Decimal(2) },
    },
    {
      id: 'haul-bars',
      name: { vi: 'Vác thỏi', en: 'Haul bars' },
      desc: { vi: 'Vác thỏi.', en: 'Haul bars.' },
      zone: 'mine',
      pose: 'pick',
      workSeconds: 1,
      input: { item: 'ore', amount: new Decimal(3) },
      output: { item: 'bar', amount: new Decimal(3) },
    },
    {
      id: 'pack',
      name: { vi: 'Đóng kiện', en: 'Pack' },
      desc: { vi: 'Đóng kiện.', en: 'Pack crates.' },
      zone: 'yard',
      pose: 'hammer',
      workSeconds: 1,
      input: { item: 'bar', amount: new Decimal(2) },
      output: { item: 'crate', amount: new Decimal(2) },
    },
  ],
}

function fresh(): ReturnType<typeof createFreshState> {
  return createFreshState(CONTENT, new Decimal(100))
}

describe('performAction', () => {
  it('gathers into the yard that owns the item', () => {
    const state = fresh()
    const result = performAction(state, CONTENT, 'strip-ore')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.actionId).toBe('strip-ore')
      expect(result.value.consumed).toBeNull()
      expectCloseTo(result.value.output.amount, new Decimal(2))
    }
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(2))
    expectCloseTo(getResource(state, 'money'), new Decimal(100))
  })

  it('converts an input into an output across warehouses (ore → bar)', () => {
    const state = fresh()
    state.stock['mine'] = { ore: new Decimal(5) }

    const result = performAction(state, CONTENT, 'haul-bars')
    expect(result.ok).toBe(true)
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(2))
    // `bar` is consumed by the yard's packer, so that is where it lands.
    expectCloseTo(getStock(state, 'yard', 'bar'), new Decimal(3))
  })

  it('refuses when the input bin cannot pay', () => {
    const state = fresh()
    state.stock['mine'] = { ore: new Decimal(1) }

    const result = performAction(state, CONTENT, 'haul-bars')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no-input')
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(1))
    expectCloseTo(getStock(state, 'yard', 'bar'), new Decimal(0))
  })

  it('refuses when the output bin is full', () => {
    const state = fresh()
    state.stock['mine'] = { ore: new Decimal(10) }

    const result = performAction(state, CONTENT, 'strip-ore')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('zone-full')
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(10))
  })

  it('refuses a job in a yard that is still locked', () => {
    const state = fresh()
    state.stock['yard'] = { bar: new Decimal(4) }

    const result = performAction(state, CONTENT, 'pack')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('locked')
    expectCloseTo(getStock(state, 'yard', 'bar'), new Decimal(4))
    expectCloseTo(getStock(state, 'yard', 'crate'), new Decimal(0))
  })

  it('works in the yard once its gate is met', () => {
    const state = fresh()
    state.branches['mine']!.workers['digger'] = 1
    state.stock['yard'] = { bar: new Decimal(4) }

    const result = performAction(state, CONTENT, 'pack')
    expect(result.ok).toBe(true)
    expectCloseTo(getStock(state, 'yard', 'bar'), new Decimal(2))
    expectCloseTo(getStock(state, 'yard', 'crate'), new Decimal(2))
  })

  it('rejects an unknown job', () => {
    const state = fresh()
    const result = performAction(state, CONTENT, 'nope')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unknown-action')
  })
})
