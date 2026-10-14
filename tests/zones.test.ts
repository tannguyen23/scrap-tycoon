import { GAME_CONTENT } from '@content/index'
import { Decimal } from '@core/num'
import { createFreshState, addStock, getStock } from '@domain/state'
import { applyRates } from '@domain/systems/production'
import type { GameContent } from '@domain/types'
import { itemZoneMap, itemZones, zoneOfItem } from '@domain/zones'
import { describe, expect, it } from 'vitest'
import { branchStateOf, expectCloseTo } from './fixtures'

/** Two-zone chain: digger (mine) → hauler → ingot (forge) → smith → money. */
function twoZoneContent(): GameContent {
  return {
    currencyItemId: 'money',
    items: {
      money: { id: 'money', name: { vi: 'Tiền', en: 'Coins' } },
      ore: { id: 'ore', name: { vi: 'Quặng', en: 'Ore' }, cap: new Decimal(20) },
      ingot: { id: 'ingot', name: { vi: 'Thỏi', en: 'Ingots' }, cap: new Decimal(5) },
    },
    zones: {
      mine: { id: 'mine', name: { vi: 'Mỏ', en: 'Mine' }, actionDesc: { vi: 'Đào.', en: 'Dig.' } },
      forge: { id: 'forge', name: { vi: 'Lò', en: 'Forge' }, actionDesc: { vi: 'Rèn.', en: 'Forge.' } },
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
            output: { item: 'ingot', ratePerUnit: new Decimal(2) },
            visual: { zone: 'mine', action: 'haul' },
          },
        ],
        recipes: [],
        upgrades: [],
      },
      forge: {
        id: 'forge',
        name: { vi: 'Lò', en: 'Forge' },
        workers: [
          {
            id: 'smith',
            name: { vi: 'Thợ rèn', en: 'Smith' },
            baseCost: new Decimal(500),
            costGrowth: new Decimal(2),
            input: { item: 'ingot', ratePerUnit: new Decimal(1) },
            output: { item: 'money', ratePerUnit: new Decimal(4) },
            visual: { zone: 'forge', action: 'work' },
          },
        ],
        recipes: [],
        upgrades: [],
      },
    },
  }
}

describe('item ↔ zone mapping', () => {
  it('assigns every chain item to the bin of the leg that consumes it', () => {
    expect(zoneOfItem(GAME_CONTENT, 'scrap')).toBe('alley')
    expect(zoneOfItem(GAME_CONTENT, 'sack')).toBe('recycle')
    expect(zoneOfItem(GAME_CONTENT, 'billet')).toBe('route')
    expect(zoneOfItem(GAME_CONTENT, 'pallet')).toBe('depot')
    expect(zoneOfItem(GAME_CONTENT, 'crate')).toBe('gate')
    expect(zoneOfItem(GAME_CONTENT, 'money')).toBeNull()
  })

  it('falls back to the producing zone for items nothing consumes', () => {
    const content = twoZoneContent()
    expect(zoneOfItem(content, 'ore')).toBe('mine')
    expect(zoneOfItem(content, 'ingot')).toBe('forge')
    expect(zoneOfItem(content, 'money')).toBeNull()
  })

  it('memoizes the map per content object', () => {
    const derived = itemZoneMap(GAME_CONTENT)
    const cached = itemZones(GAME_CONTENT)
    expect(itemZones(GAME_CONTENT)).toBe(cached)
    expect(cached.size).toBe(derived.size)
    for (const [itemId, zoneId] of derived) {
      expect(cached.get(itemId)).toBe(zoneId)
    }
  })
})

describe('per-zone warehouses', () => {
  it('seeds an empty bucket for every zone', () => {
    const state = createFreshState(GAME_CONTENT, new Decimal(0))
    for (const zoneId of Object.keys(GAME_CONTENT.zones)) {
      expect(state.stock[zoneId]).toBeDefined()
    }
    expectCloseTo(getStock(state, 'alley', 'scrap'), new Decimal(0))
    expectCloseTo(getStock(state, 'gate', 'crate'), new Decimal(0))
  })

  it('moves goods between the source and destination bins only', () => {
    const content = twoZoneContent()
    const state = createFreshState(content, new Decimal(0))
    branchStateOf(state, 'mine').workers['hauler'] = 1
    addStock(state, 'mine', 'ore', new Decimal(3))
    expectCloseTo(getStock(state, 'mine', 'ingot'), new Decimal(0))

    applyRates(state, content, 10)

    // 3 ore in the mine bin → 3 ingots into the forge bin, nothing anywhere else.
    expectCloseTo(getStock(state, 'forge', 'ingot'), new Decimal(3))
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(0))
    expectCloseTo(getStock(state, 'mine', 'ingot'), new Decimal(0))
    expectCloseTo(getStock(state, 'forge', 'ore'), new Decimal(0))
  })

  it('ignores stock misfiled into the wrong zone bin', () => {
    const content = twoZoneContent()
    const state = createFreshState(content, new Decimal(0))
    branchStateOf(state, 'mine').workers['hauler'] = 1
    addStock(state, 'mine', 'ore', new Decimal(3))
    addStock(state, 'mine', 'ingot', new Decimal(2))
    addStock(state, 'forge', 'ore', new Decimal(2))
    addStock(state, 'forge', 'ingot', new Decimal(2))

    applyRates(state, content, 10)

    // Only the mine bin feeds the leg; only the forge bin receives. Misfiled
    // entries in the other bins are inert data, never sources or sinks.
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(0))
    expectCloseTo(getStock(state, 'mine', 'ingot'), new Decimal(2))
    expectCloseTo(getStock(state, 'forge', 'ingot'), new Decimal(5))
    expectCloseTo(getStock(state, 'forge', 'ore'), new Decimal(2))
  })

  it('caps each bin on its own headroom', () => {
    const content = twoZoneContent()
    const state = createFreshState(content, new Decimal(0))
    branchStateOf(state, 'mine').workers['hauler'] = 1
    addStock(state, 'mine', 'ore', new Decimal(20))

    applyRates(state, content, 10)

    // The forge ingot bin (cap 5) back-solves the input: 5 ore consumed, 15 left.
    expectCloseTo(getStock(state, 'forge', 'ingot'), new Decimal(5))
    expectCloseTo(getStock(state, 'mine', 'ore'), new Decimal(15))
  })
})
