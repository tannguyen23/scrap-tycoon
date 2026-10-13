import { GAME_CONTENT } from '@content/index'
import { validateContent } from '@content/validate'
import { Decimal } from '@core/num'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { TEST_CONTENT } from './fixtures'

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
            },
          ],
        },
      },
    }

    const errors = validateContent(broken)
    expect(errors.length).toBeGreaterThanOrEqual(6)
    expect(errors.some((error) => error.includes('currencyItemId'))).toBe(true)
    expect(errors.some((error) => error.includes('ghost'))).toBe(true)
    expect(errors.some((error) => error.includes('zone'))).toBe(true)
    expect(errors.some((error) => error.includes('duplicate'))).toBe(true)
  })
})
