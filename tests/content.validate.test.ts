import { GAME_CONTENT } from '@content/index'
import { validateContent } from '@content/validate'
import { Decimal } from '@core/num'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { TEST_CHAIN_CONTENT, TEST_CONTENT } from './fixtures'

describe('content validation', () => {
  it('accepts the real game content and the test fixtures', () => {
    expect(validateContent(GAME_CONTENT)).toEqual([])
    expect(validateContent(TEST_CONTENT)).toEqual([])
  })

  it('catches dangling references, broken ids and duplicates', () => {
    const broken: GameContent = {
      currencyItemId: 'missing-currency',
      items: {
        ore: { id: 'ore-not-the-key', name: { vi: 'x', en: 'x' } },
      },
      zones: {},
      branches: {
        b: {
          id: 'not-b',
          name: { vi: 'x', en: 'x' },
          workers: [
            {
              id: 'w',
              name: { vi: 'x', en: 'x' },
              baseCost: new Decimal(1),
              costGrowth: new Decimal(1),
              output: { item: 'ghost', ratePerUnit: new Decimal(1) },
              visual: { zone: 'ghost-zone', action: 'pick' },
            },
            {
              id: 'w',
              name: { vi: 'x', en: 'x' },
              baseCost: new Decimal(1),
              costGrowth: new Decimal(1),
              output: { item: 'ghost', ratePerUnit: new Decimal(1) },
              visual: { zone: 'ghost-zone', action: 'pick' },
            },
          ],
          recipes: [],
          upgrades: [
            {
              id: 'u',
              name: { vi: 'x', en: 'x' },
              desc: { vi: 'x', en: 'x' },
              cost: new Decimal(0),
              effects: [],
              visual: { zone: 'ghost-zone', tier: 0 },
            },
          ],
        },
      },
    }

    const errors = validateContent(broken)
    expect(errors.length).toBeGreaterThanOrEqual(8)
    expect(errors.some((error) => error.includes('currencyItemId'))).toBe(true)
    expect(errors.some((error) => error.includes('ghost'))).toBe(true)
    expect(errors.some((error) => error.includes('zone'))).toBe(true)
    expect(errors.some((error) => error.includes('duplicate'))).toBe(true)
    expect(errors.some((error) => error.includes('raises unknown zone'))).toBe(true)
    expect(errors.some((error) => error.includes('visual tier must be an integer'))).toBe(true)
  })

  it('catches broken weather schedules', () => {
    const broken: GameContent = {
      ...TEST_CONTENT,
      weather: {
        blockSeconds: 0.35,
        transitionSeconds: 10,
        kinds: [
          {
            id: 'kind',
            label: { vi: 'x', en: 'x' },
            weight: 0,
            workMultiplier: 3,
            visual: { cloudCover: 2, rain: -1, wind: 3, lightning: -1 },
          },
          {
            id: 'kind',
            label: { vi: 'x', en: 'x' },
            weight: 1,
            workMultiplier: 1,
            visual: { cloudCover: 0, rain: 0, wind: 0, lightning: 0 },
          },
        ],
      },
    }

    const errors = validateContent(broken)
    expect(errors.some((error) => error.includes('multiple of tickSeconds'))).toBe(true)
    expect(errors.some((error) => error.includes('transitionSeconds'))).toBe(true)
    expect(errors.some((error) => error.includes('duplicate kind id'))).toBe(true)
    expect(errors.some((error) => error.includes('weight must be > 0'))).toBe(true)
    expect(errors.some((error) => error.includes('workMultiplier'))).toBe(true)
    expect(errors.some((error) => error.includes('cloudCover'))).toBe(true)
    expect(errors.some((error) => error.includes('rain'))).toBe(true)
    expect(errors.some((error) => error.includes('wind'))).toBe(true)
    expect(errors.some((error) => error.includes('lightning'))).toBe(true)
  })

  it('catches broken transport legs, caps and simulation tuning', () => {
    const branch = TEST_CHAIN_CONTENT.branches['mine']
    const oreItem = TEST_CHAIN_CONTENT.items['ore']
    if (!branch || !oreItem) throw new Error('fixture is missing the ore chain')
    const workers = branch.workers
    const first = workers[0]
    const second = workers[1]
    if (!first || !second) throw new Error('fixture is missing chain workers')

    const broken: GameContent = {
      ...TEST_CHAIN_CONTENT,
      simulation: { offlineChunkSeconds: 0 },
      items: {
        ...TEST_CHAIN_CONTENT.items,
        ore: { ...oreItem, cap: new Decimal(0) },
      },
      branches: {
        mine: {
          ...branch,
          workers: [
            first,
            // Same item in and out = a provable no-op.
            { ...second, input: { item: 'bar', ratePerUnit: new Decimal(1) } },
            { ...first, id: 'ghost', input: { item: 'ghost-item', ratePerUnit: new Decimal(0) } },
          ],
        },
      },
    }

    const errors = validateContent(broken)
    expect(errors.some((error) => error.includes('offlineChunkSeconds'))).toBe(true)
    expect(errors.some((error) => error.includes('cap must be > 0'))).toBe(true)
    expect(errors.some((error) => error.includes('must differ'))).toBe(true)
    expect(errors.some((error) => error.includes('consumes unknown item'))).toBe(true)
    expect(errors.some((error) => error.includes('input ratePerUnit must be > 0'))).toBe(true)
  })
})
