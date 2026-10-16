import { Decimal } from '@core/num'
import { moveBagSlot, putFromBag, takeToBag } from '@domain/commands'
import { bagSlotRows } from '@domain/selectors'
import { itemCarry } from '@domain/statKeys'
import { createFreshState, getBag, getStock } from '@domain/state'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { expectCloseTo, seedBag } from './fixtures'

/**
 * The bag, end to end, on a slot-based fixture: 2 slots, ore stacks at 4, bars at
 * 2. Ownership follows the same rule as the real game: an item lives in the
 * warehouse of the yard whose worker consumes it, so `ore` belongs to the mine and
 * `bar` to the yard — and neither may be dropped in the other's bin.
 *
 * `big-bag` exists only to prove the stack ceiling runs through the modifier
 * pipeline (`item.<id>.carry`), not because content ships one yet.
 */
const CONTENT: GameContent = {
  currencyItemId: 'money',
  bagSlots: 2,
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
          desc: { vi: 'x2 chỗ xếp quặng mỗi ô', en: 'x2 ore per slot' },
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
  it('fills the slots up to the last one and leaves the rest in the bin', () => {
    const state = fresh()
    state.stock['mine'] = { ore: new Decimal(10) }

    const result = takeToBag(state, CONTENT, 'mine', 'ore')

    expect(result.ok).toBe(true)
    if (result.ok) expectCloseTo(result.value.moved, new Decimal(8))
    expectCloseTo(getBag(state, 'ore'), new Decimal(8))
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(2))
    // 8 ore over 2 slots of 4 — it splits across both.
    expect(state.bag.map((slot) => slot?.amount.toString() ?? null)).toEqual(['4', '4'])
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
    seedBag(full, CONTENT, 'ore', new Decimal(8)) // both slots already full
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

  it('raises the per-slot ceiling through the item.<id>.carry modifier', () => {
    const state = fresh()
    state.stock['mine'] = { ore: new Decimal(20) }
    state.branches['mine']!.upgrades['big-bag'] = true

    const result = takeToBag(state, CONTENT, 'mine', 'ore')

    expect(result.ok).toBe(true)
    // carry 4 × big-bag 2 = 8 per slot, 2 slots → 16 fit.
    expectCloseTo(getBag(state, 'ore'), new Decimal(16))
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(4))
  })
})

describe('putFromBag', () => {
  it('stores one slot, only as much as the bin can still take', () => {
    const state = unlockYard()
    seedBag(state, CONTENT, 'bar', new Decimal(2)) // slot 0
    state.stock['yard'] = { bar: new Decimal(7) } // cap 8 → room for 1

    const result = putFromBag(state, CONTENT, 'yard', 0)

    expect(result.ok).toBe(true)
    if (result.ok) expectCloseTo(result.value.moved, new Decimal(1))
    expectCloseTo(getStock(state, 'yard', 'bar'), new Decimal(8))
    expectCloseTo(getBag(state, 'bar'), new Decimal(1))
    expect(state.bag[0]?.amount.toString()).toBe('1')
  })

  it('rejects an empty slot, a full bin and a foreign item', () => {
    const empty = unlockYard()
    const emptySlot = putFromBag(empty, CONTENT, 'yard', 0)
    expect(emptySlot.ok).toBe(false)
    if (!emptySlot.ok) expect(emptySlot.reason).toBe('empty-bag')

    const full = unlockYard()
    seedBag(full, CONTENT, 'bar', new Decimal(2))
    full.stock['yard'] = { bar: new Decimal(8) }
    const binFull = putFromBag(full, CONTENT, 'yard', 0)
    expect(binFull.ok).toBe(false)
    if (!binFull.ok) expect(binFull.reason).toBe('zone-full')
    expectCloseTo(getBag(full, 'bar'), new Decimal(2))

    const foreign = unlockYard()
    seedBag(foreign, CONTENT, 'ore', new Decimal(2))
    const wrongZone = putFromBag(foreign, CONTENT, 'yard', 0)
    expect(wrongZone.ok).toBe(false)
    if (!wrongZone.ok) expect(wrongZone.reason).toBe('wrong-zone')
    expectCloseTo(getBag(foreign, 'ore'), new Decimal(2))
  })
})

describe('moveBagSlot', () => {
  it('moves a stack into an empty slot', () => {
    const state = fresh()
    state.bag[0] = { item: 'ore', amount: new Decimal(1) }

    expect(moveBagSlot(state, CONTENT, 0, 1).ok).toBe(true)

    expect(state.bag[0]).toBeNull()
    expect(state.bag[1]?.item).toBe('ore')
    expectCloseTo(getBag(state, 'ore'), new Decimal(1))
  })

  it('merges same-item stacks up to the per-slot ceiling', () => {
    const state = fresh()
    state.bag[0] = { item: 'ore', amount: new Decimal(3) }
    state.bag[1] = { item: 'ore', amount: new Decimal(2) }

    expect(moveBagSlot(state, CONTENT, 1, 0).ok).toBe(true)

    expectCloseTo(state.bag[0]!.amount, new Decimal(4))
    expectCloseTo(state.bag[1]!.amount, new Decimal(1))
  })

  it('swaps two different stacks', () => {
    const state = fresh()
    state.bag[0] = { item: 'ore', amount: new Decimal(3) }
    state.bag[1] = { item: 'bar', amount: new Decimal(1) }

    expect(moveBagSlot(state, CONTENT, 0, 1).ok).toBe(true)

    expect(state.bag[0]?.item).toBe('bar')
    expect(state.bag[1]?.item).toBe('ore')
  })

  it('refuses a no-op move', () => {
    const state = fresh()
    state.bag[0] = { item: 'ore', amount: new Decimal(3) }
    expect(moveBagSlot(state, CONTENT, 0, 0).ok).toBe(false)
    expect(moveBagSlot(state, CONTENT, 1, 0).ok).toBe(false) // slot 1 is empty
  })
})

describe('bagSlotRows', () => {
  it('lists one entry per slot — null for empty, with the stack ceiling', () => {
    const state = fresh()
    seedBag(state, CONTENT, 'ore', new Decimal(2))

    const rows = bagSlotRows(state, CONTENT)

    expect(rows).toHaveLength(2)
    expect(rows[0]?.itemId).toBe('ore')
    expectCloseTo(rows[0]!.cap, new Decimal(4))
    expect(rows[0]!.ratio).toBeCloseTo(0.5)
    // The row knows which yard the goods may be stored in.
    expect(rows[0]!.zone).toBe('mine')
    expect(rows[1]).toBeNull()
  })
})
