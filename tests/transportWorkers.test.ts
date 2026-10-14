import { Decimal } from '@core/num'
import { hasStockDynamics, itemCapFor } from '@domain/capacity'
import { collectModifiers } from '@domain/modifiers'
import {
  incomePerSecond,
  stockRatio,
  workerInputPerUnit,
  workerOutputPerUnit,
  zoneStockItem,
} from '@domain/selectors'
import { addResource, createFreshState, getResource } from '@domain/state'
import { applyRates } from '@domain/systems/production'
import { itemCapacity } from '@domain/statKeys'
import type { GameContent } from '@domain/types'
import { describe, expect, it } from 'vitest'
import { TEST_CHAIN_CONTENT, branchStateOf, expectCloseTo } from './fixtures'

function chainState(): ReturnType<typeof createFreshState> {
  return createFreshState(TEST_CHAIN_CONTENT, new Decimal(0))
}

describe('stock caps', () => {
  it('stops production at the cap instead of banking overflow', () => {
    const state = chainState()
    branchStateOf(state, 'mine').workers['digger'] = 1

    applyRates(state, TEST_CHAIN_CONTENT, 10)

    // 5/s over 10s would be 50, but the ore bin holds 10.
    expectCloseTo(getResource(state, 'ore'), new Decimal(10))
  })

  it('reports fill ratio and knows which item a zone buffers', () => {
    const state = chainState()
    addResource(state, 'ore', new Decimal(4))
    expect(stockRatio(state, TEST_CHAIN_CONTENT, 'ore')).toBeCloseTo(0.4)
    expect(stockRatio(state, TEST_CHAIN_CONTENT, 'money')).toBeNull()
    expect(zoneStockItem(TEST_CHAIN_CONTENT, 'mine')).toBe('ore')
    expect(zoneStockItem(TEST_CHAIN_CONTENT, 'nowhere')).toBeNull()
  })

  it('resolves caps through the item.capacity stat key only (weather must not shrink bins)', () => {
    const state = chainState()
    const mods = collectModifiers(state, TEST_CHAIN_CONTENT)
    expectCloseTo(itemCapFor(TEST_CHAIN_CONTENT, 'ore', mods) ?? new Decimal(0), new Decimal(10))

    const boosted = new Map(mods)
    boosted.set(itemCapacity('ore'), { flat: [], mult: [new Decimal(2)], global: [] })
    expectCloseTo(itemCapFor(TEST_CHAIN_CONTENT, 'ore', boosted) ?? new Decimal(0), new Decimal(20))
  })
})

describe('transport legs (workers with input)', () => {
  it('does nothing while no legs are hired', () => {
    const state = chainState()
    branchStateOf(state, 'mine').workers['digger'] = 1
    addResource(state, 'ore', new Decimal(5))

    applyRates(state, TEST_CHAIN_CONTENT, 10)

    // Ore capped from digger production, but nothing moves it.
    expectCloseTo(getResource(state, 'bar'), new Decimal(0))
    expectCloseTo(getResource(state, 'ore'), new Decimal(10))
  })

  it('scales output proportionally when the upstream only partially feeds', () => {
    const state = chainState()
    branchStateOf(state, 'mine').workers['hauler'] = 1
    addResource(state, 'ore', new Decimal(3))

    applyRates(state, TEST_CHAIN_CONTENT, 10)

    // Wants 20 ore, only 3 available → 3 bars, bin empty.
    expectCloseTo(getResource(state, 'bar'), new Decimal(3))
    expectCloseTo(getResource(state, 'ore'), new Decimal(0))
  })

  it('never consumes when the downstream bin is full (nothing is destroyed)', () => {
    const state = chainState()
    branchStateOf(state, 'mine').workers['hauler'] = 1
    addResource(state, 'ore', new Decimal(5))
    addResource(state, 'bar', new Decimal(6))

    applyRates(state, TEST_CHAIN_CONTENT, 10)

    expectCloseTo(getResource(state, 'ore'), new Decimal(5))
    expectCloseTo(getResource(state, 'bar'), new Decimal(6))
  })

  it('speeds both sides of a leg with worker upgrades', () => {
    const state = chainState()
    branchStateOf(state, 'mine').workers['hauler'] = 1
    branchStateOf(state, 'mine').upgrades['belt'] = true
    addResource(state, 'ore', new Decimal(10))

    applyRates(state, TEST_CHAIN_CONTENT, 1)

    // 2/s × 2 (belt) = 4 in and 4 out.
    expectCloseTo(getResource(state, 'ore'), new Decimal(6))
    expectCloseTo(getResource(state, 'bar'), new Decimal(4))
  })

  it('applies the value markup to money outputs only', () => {
    const state = chainState()
    branchStateOf(state, 'mine').workers['hauler'] = 1
    branchStateOf(state, 'mine').workers['seller'] = 1
    branchStateOf(state, 'mine').upgrades['scale'] = true
    addResource(state, 'bar', new Decimal(6))

    applyRates(state, TEST_CHAIN_CONTENT, 1)

    // Seller: 1 bar → 20 money ×1.5 markup. Hauler stays 1:1 (no matter conjured).
    expectCloseTo(getResource(state, 'money'), new Decimal(30))
    expectCloseTo(getResource(state, 'bar'), new Decimal(5))
  })

  it('shows honest in/out readouts for the HUD', () => {
    const state = chainState()
    branchStateOf(state, 'mine').workers['hauler'] = 1
    branchStateOf(state, 'mine').workers['seller'] = 1
    branchStateOf(state, 'mine').upgrades['belt'] = true
    branchStateOf(state, 'mine').upgrades['scale'] = true

    expectCloseTo(workerInputPerUnit(state, TEST_CHAIN_CONTENT, 'mine', 'hauler') ?? new Decimal(0), new Decimal(4))
    expectCloseTo(workerOutputPerUnit(state, TEST_CHAIN_CONTENT, 'mine', 'hauler'), new Decimal(4))
    expectCloseTo(workerInputPerUnit(state, TEST_CHAIN_CONTENT, 'mine', 'seller') ?? new Decimal(0), new Decimal(2))
    // 1 bar/s × 2 speed × 20 money/bar × 1.5 markup
    expectCloseTo(workerOutputPerUnit(state, TEST_CHAIN_CONTENT, 'mine', 'seller'), new Decimal(60))
    expect(workerInputPerUnit(state, TEST_CHAIN_CONTENT, 'mine', 'digger')).toBeNull()
  })

  it('reads a saturated chain as near-zero income', () => {
    const state = chainState()
    branchStateOf(state, 'mine').workers['digger'] = 1
    addResource(state, 'ore', new Decimal(10))

    // No leg to move anything: the projection must not pretend the chain earns.
    expectCloseTo(incomePerSecond(state, TEST_CHAIN_CONTENT), new Decimal(0))
  })

  it('clamps recipe output to the downstream cap by back-solving the input', () => {
    const branch = TEST_CHAIN_CONTENT.branches['mine']
    if (!branch) throw new Error('fixture is missing the mine branch')
    const content: GameContent = {
      ...TEST_CHAIN_CONTENT,
      branches: {
        mine: {
          ...branch,
          recipes: [
            {
              id: 'cast',
              name: { vi: 'Đúc', en: 'Cast' },
              input: { item: 'ore', rate: new Decimal(2) },
              output: { item: 'bar', perInputUnit: new Decimal(1) },
            },
          ],
        },
      },
    }
    const state = createFreshState(content, new Decimal(0))
    addResource(state, 'ore', new Decimal(10))
    addResource(state, 'bar', new Decimal(5))

    applyRates(state, content, 10)

    // Room for one bar → exactly one ore consumed, despite a 20-ore appetite.
    expectCloseTo(getResource(state, 'bar'), new Decimal(6))
    expectCloseTo(getResource(state, 'ore'), new Decimal(9))
  })

  it('detects when content needs chunked offline', () => {
    expect(hasStockDynamics(TEST_CHAIN_CONTENT)).toBe(true)
  })
})
