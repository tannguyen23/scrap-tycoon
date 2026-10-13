import { Decimal } from '@core/num'
import { branchRecipeOutput, branchWorkerOutput } from '@domain/statKeys'
import type { BranchDef, BranchState, GameContent, GameState } from '@domain/types'
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
      ],
    },
  },
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
