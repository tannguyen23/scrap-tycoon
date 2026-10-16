import { Decimal } from '@core/num'
import { putFromBag, takeToBag } from '@domain/commands'
import { bagRows } from '@domain/selectors'
import { itemCarry } from '@domain/statKeys'
import { createFreshState, getBag, getStock } from '@domain/state'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { expectCloseTo } from './fixtures'

/**
 * The bag, end to end. Ownership follows the same rule as the real game: an item
 * lives in the warehouse of the yard whose worker consumes it, so `ore` belongs
 * to the mine and `bar` to the yard — and neither may be dropped in the other's
 * bin (that would be inert data).
 *
 * `big-bag` exists only to prove the bag ceiling runs through the modifier
 * pipeline (`item.<id>.carry`), not because content ships one yet.
 */
const CONTENT: GameContent = {
  currencyItemId: 'money',
  items: {
    money: { id: 'money', name: { vi: 'Tiền', en: 'Coins' } },
    ore: { id: 'ore', name: { vi: 'Quặng', en: 'Ore' }, cap: new Decimal(10), carry: new Decimal(4) },
    bar: { id: 'bar', name: { vi: 'Thỏi', en: 'Bars' }, cap: new Decimal(8), carry: new Decimal(2) },
  },
  zones: {
    mine: { id: 'mine', name: { vi: 'Mỏ', en: 'Mine' }, actionDesc: { vi: 'Đào.', en: 'Dig.' } },
    yard: {
      id: 'yard',
      name: { vi: 'Bãi', en: 'Yard' },
      actionDesc: { vi: 'Đóng.', en: 'Pack.' },
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
        {
          id: 'packer',
          name: { vi: 'Thợ đóng', en: 'Packer' },
          baseCost: new Decimal(500),
          costGrowth: new Decimal(2),
          input: { item: 'bar', ratePerUnit: new Decimal(1) },
          output: { item: 'money', ratePerUnit: new Decimal(5) },
          visual: { zone: 'yard', action: 'work' },
        },
      ],
      recipes: [],
      upgrades: [
        {
          id: 'big-bag',
          name: { vi: 'Bao bự', en: 'Big Bag' },
          desc: { vi: 'x2 chỗ chứa quặng trong túi', en: 'x2 ore in the bag' },
          cost: new Decimal(100),
          effects: [{ target: itemCarry('ore'), kind: 'mult', value: new Decimal(2) }],
        },
      ],
    },
  },
}

function fresh(): ReturnType<typeof createFreshState> {
  return createFreshState(CONTENT, new Decimal(100))
}

function unlockYard(): ReturnType<typeof createFreshState> {
  const state = fresh()
  state.branches['mine']!.workers['digger'] = 1
  return state
}

describe('takeToBag', () => {
  it('fills the bag up to its ceiling and leaves the rest in the bin', () => {
    const state = fresh()
    state.stock['mine'] = { ore: new Decimal(6) }

    const result = takeToBag(state, CONTENT, 'mine', 'ore')

    expect(result.ok).toBe(true)
    if (result.ok) expectCloseTo(result.value.moved, new Decimal(4))
    expectCloseTo(getBag(state, 'ore'), new Decimal(4))
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(2))
  })

  it('takes the whole bin when the bag has room for it', () => {
    const state = fresh()
    state.stock['mine'] = { ore: new Decimal(2.5) }

    const result = takeToBag(state, CONTENT, 'mine', 'ore')

    expect(result.ok).toBe(true)
    expectCloseTo(getBag(state, 'ore'), new Decimal(2.5))
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(0))
  })

  it('rejects an empty bin, a full bag, a foreign item and a locked yard', () => {
    const empty = fresh()
    const noStock = takeToBag(empty, CONTENT, 'mine', 'ore')
    expect(noStock.ok).toBe(false)
    if (!noStock.ok) expect(noStock.reason).toBe('no-stock')

    const full = fresh()
    full.stock['mine'] = { ore: new Decimal(3) }
    full.bag['ore'] = new Decimal(4)
    const bagFull = takeToBag(full, CONTENT, 'mine', 'ore')
    expect(bagFull.ok).toBe(false)
    if (!bagFull.ok) expect(bagFull.reason).toBe('bag-full')
    expectCloseTo(getStock(full, 'mine', 'ore'), new Decimal(3))

    const foreign = fresh()
    foreign.stock['mine'] = { ore: new Decimal(3) }
    const wrongZone = takeToBag(foreign, CONTENT, 'mine', 'bar')
    expect(wrongZone.ok).toBe(false)
    if (!wrongZone.ok) expect(wrongZone.reason).toBe('wrong-zone')

    const locked = fresh()
    locked.stock['yard'] = { bar: new Decimal(3) }
    const gated = takeToBag(locked, CONTENT, 'yard', 'bar')
    expect(gated.ok).toBe(false)
    if (!gated.ok) expect(gated.reason).toBe('locked')

    expect(takeToBag(fresh(), CONTENT, 'quarry', 'ore').ok).toBe(false)
    expect(takeToBag(fresh(), CONTENT, 'mine', 'gold').ok).toBe(false)
  })

  it('raises the ceiling through the item.<id>.carry modifier', () => {
    const state = fresh()
    state.stock['mine'] = { ore: new Decimal(9) }
    state.branches['mine']!.upgrades['big-bag'] = true

    const result = takeToBag(state, CONTENT, 'mine', 'ore')

    expect(result.ok).toBe(true)
    expectCloseTo(getBag(state, 'ore'), new Decimal(8))
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(1))
  })
})

describe('putFromBag', () => {
  it('stores everything the bin can still take', () => {
    const state = unlockYard()
    state.bag['bar'] = new Decimal(2)
    state.stock['yard'] = { bar: new Decimal(7) }

    const result = putFromBag(state, CONTENT, 'yard', 'bar')

    expect(result.ok).toBe(true)
    if (result.ok) expectCloseTo(result.value.moved, new Decimal(1))
    expectCloseTo(getStock(state, 'yard', 'bar'), new Decimal(8))
    expectCloseTo(getBag(state, 'bar'), new Decimal(1))
  })

  it('rejects an empty bag, a full bin and a foreign item', () => {
    const empty = unlockYard()
    const emptyBag = putFromBag(empty, CONTENT, 'yard', 'bar')
    expect(emptyBag.ok).toBe(false)
    if (!emptyBag.ok) expect(emptyBag.reason).toBe('empty-bag')

    const full = unlockYard()
    full.bag['bar'] = new Decimal(2)
    full.stock['yard'] = { bar: new Decimal(8) }
    const binFull = putFromBag(full, CONTENT, 'yard', 'bar')
    expect(binFull.ok).toBe(false)
    if (!binFull.ok) expect(binFull.reason).toBe('zone-full')
    expectCloseTo(getBag(full, 'bar'), new Decimal(2))

    const foreign = unlockYard()
    foreign.bag['ore'] = new Decimal(2)
    const wrongZone = putFromBag(foreign, CONTENT, 'yard', 'ore')
    expect(wrongZone.ok).toBe(false)
    if (!wrongZone.ok) expect(wrongZone.reason).toBe('wrong-zone')
    expectCloseTo(getBag(foreign, 'ore'), new Decimal(2))
  })
})

describe('bagRows', () => {
  it('lists only what is carried, with the ceiling of each item', () => {
    const state = unlockYard()
    state.bag['ore'] = new Decimal(2)
    state.bag['bar'] = new Decimal(0)

    const rows = bagRows(state, CONTENT)

    expect(rows.map((row) => row.itemId)).toEqual(['ore'])
    expectCloseTo(rows[0]!.carry ?? new Decimal(0), new Decimal(4))
    expect(rows[0]!.ratio).toBeCloseTo(0.5)
    // The row knows which yard the goods may be stored in.
    expect(rows[0]!.zone).toBe('mine')
  })
})
