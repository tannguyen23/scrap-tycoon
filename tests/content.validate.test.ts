import { GAME_CONTENT } from '@content/index'
import { validateContent } from '@content/validate'
import { Decimal } from '@core/num'
import type { GameContent, GearSlot } from '@domain/types'
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

  it('catches hand-work jobs that break their yard', () => {
    const broken: GameContent = {
      ...TEST_CONTENT,
      // A second yard so a job can point at the wrong warehouse.
      zones: {
        ...TEST_CONTENT.zones,
        hut: { id: 'hut', name: { vi: 'Chòi', en: 'Hut' }, actionDesc: { vi: 'x', en: 'x' } },
      },
      actions: [
        {
          id: 'in-the-void',
          name: { vi: 'x', en: 'x' },
          desc: { vi: 'x', en: 'x' },
          zone: 'ghost-zone',
          pose: 'poke',
          workSeconds: 1,
          output: { item: 'ore', amount: new Decimal(1) },
          requires: { kind: 'workers', branch: 'ghost-branch', worker: 'ghost', count: 1 },
        },
        {
          id: 'nonsense',
          name: { vi: 'x', en: 'x' },
          desc: { vi: 'x', en: 'x' },
          zone: 'mine',
          pose: 'pick',
          workSeconds: 0,
          output: { item: 'ghost-item', amount: new Decimal(1) },
        },
        {
          id: 'empty-input',
          name: { vi: 'x', en: 'x' },
          desc: { vi: 'x', en: 'x' },
          zone: 'mine',
          pose: 'hammer',
          workSeconds: 1,
          input: { item: 'ore', amount: new Decimal(0) },
          output: { item: 'money', amount: new Decimal(1) },
        },
        {
          // Duplicate id, and it draws ore (a mine item) while standing in the hut.
          id: 'nonsense',
          name: { vi: 'x', en: 'x' },
          desc: { vi: 'x', en: 'x' },
          zone: 'hut',
          pose: 'pick',
          workSeconds: 1,
          input: { item: 'ore', amount: new Decimal(1) },
          output: { item: 'money', amount: new Decimal(1) },
        },
      ],
    }

    const errors = validateContent(broken)
    expect(errors.some((error) => error.includes('unknown zone'))).toBe(true)
    expect(errors.some((error) => error.includes('gathers into zone "mine"'))).toBe(true)
    expect(errors.some((error) => error.includes('unknown branch'))).toBe(true)
    expect(errors.some((error) => error.includes('outputs unknown item'))).toBe(true)
    expect(errors.some((error) => error.includes('workSeconds must be > 0'))).toBe(true)
    expect(errors.some((error) => error.includes('input amount must be > 0'))).toBe(true)
    expect(errors.some((error) => error.includes('duplicate id'))).toBe(true)
    expect(errors.some((error) => error.includes('draws "ore" from zone "mine"'))).toBe(true)
  })

  it('catches dangling progression conditions and broken milestones', () => {
    const branch = TEST_CONTENT.branches['mine']
    const zone = TEST_CONTENT.zones['mine']
    if (!branch || !zone) throw new Error('fixture is missing the mine branch/zone')

    const broken: GameContent = {
      ...TEST_CONTENT,
      zones: {
        mine: { ...zone, requires: { kind: 'workers', branch: 'mine', worker: 'ghost-worker', count: 0 } },
      },
      branches: {
        mine: {
          ...branch,
          requires: { kind: 'upgrade', branch: 'ghost-branch', upgrade: 'ghost' },
          upgrades: branch.upgrades.map((upgrade) =>
            upgrade.id === 'boots'
              ? { ...upgrade, requires: { kind: 'playTime', seconds: 0 } }
              : upgrade,
          ),
        },
      },
      milestones: [
        {
          id: 'dup',
          name: { vi: 'x', en: 'x' },
          desc: { vi: 'x', en: 'x' },
          requires: { kind: 'totalEarned', amount: new Decimal(0) },
          reward: [{ target: '', kind: 'mult', value: new Decimal(1) }],
        },
        {
          id: 'dup',
          name: { vi: 'x', en: 'x' },
          desc: { vi: 'x', en: 'x' },
          requires: { kind: 'workers', branch: 'ghost-branch', worker: 'ghost', count: 1 },
        },
      ],
    }

    const errors = validateContent(broken)
    expect(errors.some((error) => error.includes('unknown worker'))).toBe(true)
    expect(errors.some((error) => error.includes('count must be an integer >= 1'))).toBe(true)
    expect(errors.some((error) => error.includes('unknown branch'))).toBe(true)
    expect(errors.some((error) => error.includes('seconds must be > 0'))).toBe(true)
    expect(errors.some((error) => error.includes('amount must be > 0'))).toBe(true)
    expect(errors.some((error) => error.includes('milestone duplicate id'))).toBe(true)
    expect(errors.some((error) => error.includes('empty target'))).toBe(true)
  })

  it('catches gear that would fight over a slot or grant nothing', () => {
    const broken: GameContent = {
      ...TEST_CONTENT,
      gear: [
        {
          id: 'dup',
          slot: 'shirt',
          name: { vi: 'x', en: 'x' },
          desc: { vi: 'x', en: 'x' },
          cost: new Decimal(0),
          effects: [],
          style: '',
        },
        {
          id: 'dup',
          slot: 'shirt',
          name: { vi: 'x', en: 'x' },
          desc: { vi: 'x', en: 'x' },
          cost: new Decimal(10),
          effects: [{ target: 'x', kind: 'mult', value: new Decimal(0) }],
          style: 'vest',
          requires: { kind: 'workers', branch: 'ghost-branch', worker: 'ghost', count: 1 },
        },
        {
          id: 'moon-boots',
          // Deliberately outside the slot union — the validator must catch content
          // that was never type-checked against this build.
          slot: 'spacesuit' as GearSlot,
          name: { vi: 'x', en: 'x' },
          desc: { vi: 'x', en: 'x' },
          cost: new Decimal(10),
          effects: [{ target: 'x', kind: 'mult', value: new Decimal(1) }],
          style: 'boot',
        },
      ],
    }

    const errors = validateContent(broken)
    expect(errors.some((error) => error.includes('gear "dup": duplicate id'))).toBe(true)
    expect(errors.some((error) => error.includes('slot "shirt" already has a piece'))).toBe(true)
    expect(errors.some((error) => error.includes('unknown slot "spacesuit"'))).toBe(true)
    expect(errors.some((error) => error.includes('cost must be > 0'))).toBe(true)
    expect(errors.some((error) => error.includes('has no effects'))).toBe(true)
    expect(errors.some((error) => error.includes('style must not be empty'))).toBe(true)
    expect(errors.some((error) => error.includes('effect value must be > 0'))).toBe(true)
    expect(errors.some((error) => error.includes('unknown branch'))).toBe(true)
  })
})
