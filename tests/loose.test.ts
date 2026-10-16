import { Decimal } from '@core/num'
import { pickLoose } from '@domain/commands'
import { looseSpawnTick } from '@domain/loose'
import { createFreshState, getBag, stateFromSerialized, stateToSerialized } from '@domain/state'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { expectCloseTo, seedBag } from './fixtures'

/**
 * Debris on the yard floor: it scatters over time (capped), the player picks it
 * up by hand, and — being transient — it never reaches the save.
 */
const CONTENT: GameContent = {
  currencyItemId: 'money',
  bagSlots: 4,
  items: {
    money: { id: 'money', name: { vi: 'Tiền', en: 'Coins' } },
    scrap: { id: 'scrap', name: { vi: 'Sắt vụn', en: 'Scrap' }, carry: new Decimal(10) },
  },
  zones: {
    alley: { id: 'alley', name: { vi: 'Bãi', en: 'Yard' }, actionDesc: { vi: 'Bới.', en: 'Pick.' } },
  },
  branches: {},
  loose: [{ zone: 'alley', item: 'scrap', amount: new Decimal(2), secondsPerItem: 1, cap: 3 }],
}

function fresh(): ReturnType<typeof createFreshState> {
  return createFreshState(CONTENT, new Decimal(0))
}

describe('loose spawn', () => {
  it('scatters pieces on the clock and never past the cap', () => {
    const state = fresh()
    looseSpawnTick(state, CONTENT, 0.5)
    expect(state.loose.items).toHaveLength(0)
    looseSpawnTick(state, CONTENT, 0.5)
    expect(state.loose.items).toHaveLength(1)
    looseSpawnTick(state, CONTENT, 3)
    expect(state.loose.items).toHaveLength(3)
    looseSpawnTick(state, CONTENT, 5)
    expect(state.loose.items).toHaveLength(3)
    expect(
      state.loose.items.every((piece) => piece.zone === 'alley' && piece.item === 'scrap'),
    ).toBe(true)
  })

  it('hands ids out in order and refills right after a pickup', () => {
    const state = fresh()
    looseSpawnTick(state, CONTENT, 3)
    expect(state.loose.items.map((piece) => piece.id)).toEqual([1, 2, 3])

    const first = state.loose.items[0]
    expect(first).toBeDefined()
    expect(pickLoose(state, CONTENT, first?.id ?? 0).ok).toBe(true)
    expect(state.loose.items.map((piece) => piece.id)).toEqual([2, 3])

    looseSpawnTick(state, CONTENT, 1)
    expect(state.loose.items).toHaveLength(3)
  })
})

describe('pickLoose', () => {
  it('moves the piece into the bag and lifts it off the floor', () => {
    const state = fresh()
    looseSpawnTick(state, CONTENT, 3)
    const piece = state.loose.items[0]
    expect(piece).toBeDefined()

    const result = pickLoose(state, CONTENT, piece?.id ?? 0)

    expect(result.ok).toBe(true)
    if (result.ok) expectCloseTo(result.value.amount, new Decimal(2))
    expectCloseTo(getBag(state, 'scrap'), new Decimal(2))
    expect(state.loose.items.some((entry) => entry.id === piece?.id)).toBe(false)
  })

  it('refuses a missing piece and a full bag, leaving the floor untouched', () => {
    const state = fresh()
    const missing = pickLoose(state, CONTENT, 99)
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.reason).toBe('loose-missing')

    looseSpawnTick(state, CONTENT, 3)
    seedBag(state, CONTENT, 'scrap', new Decimal(40)) // 4 slots × carry 10 = full
    const piece = state.loose.items[0]
    const full = pickLoose(state, CONTENT, piece?.id ?? 0)
    expect(full.ok).toBe(false)
    if (!full.ok) expect(full.reason).toBe('bag-full')
    expect(state.loose.items).toHaveLength(3)
  })
})

describe('transient ground state', () => {
  it('never lands in the save and starts empty on load', () => {
    const state = fresh()
    looseSpawnTick(state, CONTENT, 3)
    expect(state.loose.items).toHaveLength(3)

    const saved = stateToSerialized(state)
    expect('loose' in saved).toBe(false)

    const restored = stateFromSerialized(saved, CONTENT, new Decimal(0))
    expect(restored.state.loose.items).toEqual([])
    expect(restored.state.loose.seq).toBe(0)
  })
})
