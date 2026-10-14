import { Decimal } from '@core/num'
import { branchRecipeOutput, branchWorkerOutput, workerStepOutput } from '@domain/statKeys'
import type { BranchDef, BranchState, GameContent, GameState, WeatherProfile } from '@domain/types'
import { weatherWorkMultiplier } from '@domain/weather'
import { expect } from 'vitest'

/** Small hand-built content for domain unit tests (the golden test uses the real game content). */
export const TEST_CONTENT: GameContent = {
  currencyItemId: 'money',
  items: {
    money: { id: 'money', name: { vi: 'Tiền', en: 'Coins' } },
    ore: { id: 'ore', name: { vi: 'Quặng', en: 'Ore' }, unit: { vi: 'kg', en: 'kg' } },
  },
  zones: {
    mine: {
      id: 'mine',
      name: { vi: 'Mỏ', en: 'Mine' },
      actionDesc: { vi: 'Thợ đào quặng.', en: 'Diggers mine ore.' },
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
          id: 'drill',
          name: { vi: 'Máy khoan', en: 'Drill' },
          baseCost: new Decimal(100),
          costGrowth: new Decimal(2),
          output: { item: 'ore', ratePerUnit: new Decimal(5) },
          visual: { zone: 'mine', action: 'work' },
        },
      ],
      recipes: [
        {
          id: 'sell',
          name: { vi: 'Bán quặng', en: 'Sell ore' },
          input: { item: 'ore', rate: null },
          output: { item: 'money', perInputUnit: new Decimal('0.5') },
        },
      ],
      upgrades: [
        {
          id: 'boots',
          name: { vi: 'Ủng da', en: 'Leather Boots' },
          desc: { vi: 'x2 sản lượng thợ', en: 'x2 worker output' },
          cost: new Decimal(50),
          effects: [{ target: branchWorkerOutput('mine'), kind: 'mult', value: new Decimal(2) }],
        },
        {
          id: 'gloves',
          name: { vi: 'Găng tay', en: 'Work Gloves' },
          desc: { vi: '+50% giá bán', en: '+50% sale value' },
          cost: new Decimal(200),
          effects: [{ target: branchRecipeOutput('mine'), kind: 'mult', value: new Decimal('1.5') }],
        },
        {
          id: 'lift',
          name: { vi: 'Thang tời', en: 'Mine Hoist' },
          desc: { vi: 'Nâng cấp xe mỏ lên bậc 1', en: 'Upgrades the mine fleet (tier 1)' },
          cost: new Decimal(1000),
          effects: [{ target: branchWorkerOutput('mine'), kind: 'mult', value: new Decimal('1.2') }],
          visual: { zone: 'mine', tier: 1 },
        },
        {
          id: 'rail',
          name: { vi: 'Đường ray mỏ', en: 'Mine Rail' },
          desc: { vi: 'Nâng cấp xe mỏ lên bậc 2', en: 'Upgrades the mine fleet (tier 2)' },
          cost: new Decimal(5000),
          effects: [{ target: branchWorkerOutput('mine'), kind: 'mult', value: new Decimal('1.3') }],
          visual: { zone: 'mine', tier: 2 },
        },
      ],
    },
  },
}

/** Tiny weather profile for domain tests: 10s blocks keep the schedules instant. */
export const TEST_WEATHER: WeatherProfile = {
  blockSeconds: 10,
  transitionSeconds: 2,
  kinds: [
    {
      id: 'clear',
      label: { vi: 'Nắng', en: 'Clear' },
      weight: 3,
      workMultiplier: 1,
      visual: { cloudCover: 0.1, rain: 0, wind: 0.2, lightning: 0 },
    },
    {
      id: 'rain',
      label: { vi: 'Mưa', en: 'Rain' },
      weight: 2,
      workMultiplier: 0.5,
      visual: { cloudCover: 0.9, rain: 0.8, wind: 0.5, lightning: 0 },
    },
    {
      id: 'storm',
      label: { vi: 'Bão', en: 'Storm' },
      weight: 1,
      workMultiplier: 0.25,
      visual: { cloudCover: 1, rain: 1, wind: 1.5, lightning: 2 },
    },
  ],
}

export const TEST_WEATHER_CONTENT: GameContent = { ...TEST_CONTENT, weather: TEST_WEATHER }

/**
 * Chain fixture for stock caps + transport legs:
 *   digger (5 ore/s) → ore bin (cap 10) → hauler (2 ore/s → 2 bars/s)
 *   → bar rack (cap 6) → seller (1 bar/s → 20 money/s) → money
 */
export const TEST_CHAIN_CONTENT: GameContent = {
  currencyItemId: 'money',
  simulation: { offlineChunkSeconds: 1 },
  items: {
    money: { id: 'money', name: { vi: 'Tiền', en: 'Coins' } },
    ore: { id: 'ore', name: { vi: 'Quặng', en: 'Ore' }, unit: { vi: 'kg', en: 'kg' }, cap: new Decimal(10) },
    bar: { id: 'bar', name: { vi: 'Thỏi', en: 'Bars' }, unit: { vi: 'thỏi', en: 'bars' }, cap: new Decimal(6) },
  },
  zones: {
    mine: {
      id: 'mine',
      name: { vi: 'Mỏ', en: 'Mine' },
      actionDesc: { vi: 'Khai thác và luyện.', en: 'Digging and smelting.' },
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
          output: { item: 'ore', ratePerUnit: new Decimal(5) },
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
          id: 'seller',
          name: { vi: 'Người bán', en: 'Seller' },
          baseCost: new Decimal(500),
          costGrowth: new Decimal(2),
          input: { item: 'bar', ratePerUnit: new Decimal(1) },
          output: { item: 'money', ratePerUnit: new Decimal(20) },
          visual: { zone: 'mine', action: 'work' },
        },
      ],
      recipes: [],
      upgrades: [
        {
          id: 'belt',
          name: { vi: 'Băng tải', en: 'Belt' },
          desc: { vi: 'x2 tốc độ thợ', en: 'x2 worker speed' },
          cost: new Decimal(100),
          effects: [{ target: branchWorkerOutput('mine'), kind: 'mult', value: new Decimal(2) }],
        },
        {
          id: 'scale',
          name: { vi: 'Cân', en: 'Scale' },
          desc: { vi: '+50% giá bán tiền', en: '+50% money value' },
          cost: new Decimal(200),
          effects: [{ target: branchRecipeOutput('mine'), kind: 'mult', value: new Decimal('1.5') }],
        },
        {
          id: 'hauler-gear',
          name: { vi: 'Đồ nghề vác', en: 'Hauler Gear' },
          desc: { vi: 'x2 tốc độ người vác', en: 'x2 hauler speed' },
          cost: new Decimal(300),
          effects: [{ target: workerStepOutput('mine', 'hauler'), kind: 'mult', value: new Decimal(2) }],
        },
      ],
    },
  },
}

/** First `playTimeS` inside a penalized weather block — the schedule is deterministic. */
export function findPenalizedTime(profile: WeatherProfile, limit = 1000): number {
  for (let block = 1; block <= limit; block++) {
    const at = block * profile.blockSeconds + 1
    if (weatherWorkMultiplier(profile, at) !== 1) return at
  }
  throw new Error('test weather profile never penalizes — weights are wrong')
}

export function branchDef(content: GameContent, branchId: string): BranchDef {
  const branch = content.branches[branchId]
  if (!branch) throw new Error(`fixture is missing branch def "${branchId}"`)
  return branch
}

export function branchStateOf(state: GameState, branchId: string): BranchState {
  const branch = state.branches[branchId]
  if (!branch) throw new Error(`fixture is missing branch state "${branchId}"`)
  return branch
}

/** Compares Decimal values with a relative tolerance. */
export function expectCloseTo(
  actual: Decimal,
  expected: Decimal | number | string,
  relativeTolerance = 1e-9,
): void {
  const exp = new Decimal(expected)
  const close = exp.eq(0)
    ? actual.abs().lte(relativeTolerance)
    : actual.sub(exp).abs().div(exp.abs()).lte(relativeTolerance)
  expect(close, `${actual.toString()} !≈ ${exp.toString()}`).toBe(true)
}
