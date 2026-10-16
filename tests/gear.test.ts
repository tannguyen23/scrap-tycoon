import { Decimal } from '@core/num'
import { buyGear } from '@domain/commands'
import { gearRows, playerWalkSpeed, playerWorkSpeed } from '@domain/selectors'
import { GLOBAL_CARRY, PLAYER_WALK_SPEED, PLAYER_WORK_SPEED } from '@domain/statKeys'
import { carryCapFor } from '@domain/capacity'
import { collectModifiers } from '@domain/modifiers'
import { createFreshState, getResource } from '@domain/state'
import { GEAR_SLOTS } from '@domain/types'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { expectCloseTo } from './fixtures'

/**
 * Gear: money-only purchases the character wears. Owning a piece is wearing it, so
 * `state.gear` is the whole state — and every bonus has to come out of the modifier
 * pipeline (never a hand-rolled multiplier in a system or the UI).
 *
 * `boots` is gated on a worker so the `locked` path can be exercised.
 */
const CONTENT: GameContent = {
  currencyItemId: 'money',
  items: {
    money: { id: 'money', name: { vi: 'Tiền', en: 'Coins' } },
    ore: { id: 'ore', name: { vi: 'Quặng', en: 'Ore' }, cap: new Decimal(10), carry: new Decimal(4) },
  },
  zones: {
    mine: { id: 'mine', name: { vi: 'Mỏ', en: 'Mine' }, actionDesc: { vi: 'Đào.', en: 'Dig.' } },
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
      ],
      recipes: [],
      upgrades: [],
    },
  },
  gear: [
    {
      id: 'vest',
      slot: 'shirt',
      name: { vi: 'Áo', en: 'Vest' },
      desc: { vi: 'Túi áo.', en: 'Pockets.' },
      cost: new Decimal(100),
      effects: [{ target: GLOBAL_CARRY, kind: 'mult', value: new Decimal('1.5') }],
      style: 'vest',
    },
    {
      id: 'hat',
      slot: 'hat',
      name: { vi: 'Nón', en: 'Hat' },
      desc: { vi: 'Làm nhanh hơn.', en: 'Work faster.' },
      cost: new Decimal(20),
      effects: [{ target: PLAYER_WORK_SPEED, kind: 'mult', value: new Decimal('1.5') }],
      style: 'hard',
    },
    {
      id: 'boots',
      slot: 'boots',
      name: { vi: 'Ủng', en: 'Boots' },
      desc: { vi: 'Đi nhanh hơn.', en: 'Walk faster.' },
      cost: new Decimal(50),
      effects: [{ target: PLAYER_WALK_SPEED, kind: 'mult', value: new Decimal(2) }],
      style: 'boot',
      requires: { kind: 'workers', branch: 'mine', worker: 'digger', count: 1 },
    },
  ],
}

function fresh(): ReturnType<typeof createFreshState> {
  return createFreshState(CONTENT, new Decimal(100))
}

describe('buyGear', () => {
  it('pays the price and marks the piece as worn', () => {
    const state = fresh()
    const result = buyGear(state, CONTENT, 'vest')

    expect(result.ok).toBe(true)
    if (result.ok) expectCloseTo(result.value.cost, new Decimal(100))
    expect(state.gear['vest']).toBe(true)
    expectCloseTo(getResource(state, 'money'), new Decimal(0))
  })

  it('rejects an unknown piece, a second purchase and an unaffordable one without touching state', () => {
    const unknown = fresh()
    const noPiece = buyGear(unknown, CONTENT, 'jetpack')
    expect(noPiece.ok).toBe(false)
    if (!noPiece.ok) expect(noPiece.reason).toBe('unknown-gear')

    const owned = fresh()
    expect(buyGear(owned, CONTENT, 'boots').ok).toBe(false) // locked, see below
    expect(buyGear(owned, CONTENT, 'vest').ok).toBe(true)
    const again = buyGear(owned, CONTENT, 'vest')
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.reason).toBe('already-owned')
    expectCloseTo(getResource(owned, 'money'), new Decimal(0))

    const broke = fresh()
    broke.resources['money'] = new Decimal(5)
    const poor = buyGear(broke, CONTENT, 'vest')
    expect(poor.ok).toBe(false)
    if (!poor.ok) expect(poor.reason).toBe('not-enough-money')
    expectCloseTo(getResource(broke, 'money'), new Decimal(5))
    expect(broke.gear['vest']).toBeUndefined()
  })

  it('keeps a gated piece locked until its condition holds', () => {
    const state = fresh()
    const locked = buyGear(state, CONTENT, 'boots')
    expect(locked.ok).toBe(false)
    if (!locked.ok) expect(locked.reason).toBe('locked')
    expectCloseTo(getResource(state, 'money'), new Decimal(100))

    state.branches['mine']!.workers['digger'] = 1
    expect(buyGear(state, CONTENT, 'boots').ok).toBe(true)
    expect(state.gear['boots']).toBe(true)
  })
})

describe('gear effects', () => {
  it('feeds the bag ceiling, the work speed and the walk speed', () => {
    const state = fresh()
    expectCloseTo(playerWorkSpeed(state, CONTENT), new Decimal(1))
    expectCloseTo(playerWalkSpeed(state, CONTENT), new Decimal(1))
    expectCloseTo(carryCapFor(CONTENT, 'ore', collectModifiers(state, CONTENT)) ?? new Decimal(0), new Decimal(4))

    state.gear['vest'] = true
    state.gear['hat'] = true
    state.gear['boots'] = true

    // `global.carry` rides on top of the item's own ceiling, like every other merge.
    expectCloseTo(carryCapFor(CONTENT, 'ore', collectModifiers(state, CONTENT)) ?? new Decimal(0), new Decimal(6))
    expectCloseTo(playerWorkSpeed(state, CONTENT), new Decimal('1.5'))
    expectCloseTo(playerWalkSpeed(state, CONTENT), new Decimal(2))
  })
})

describe('gearRows', () => {
  it('lists every slot in a fixed order, with price and gate making sense', () => {
    const state = fresh()
    const locked = gearRows(state, CONTENT)

    expect(locked.map((row) => row.slot)).toEqual([...GEAR_SLOTS])
    const boots = locked.find((row) => row.slot === 'boots')
    expect(boots?.gear?.id).toBe('boots')
    expect(boots?.owned).toBe(false)
    expectCloseTo(boots?.cost ?? new Decimal(0), new Decimal(50))
    expect(boots?.requirement?.kind).toBe('workers')

    state.gear['vest'] = true
    const worn = gearRows(state, CONTENT).find((row) => row.slot === 'shirt')
    expect(worn?.owned).toBe(true)
    expect(worn?.cost).toBeNull()
    expect(worn?.requirement).toBeNull()
  })
})
