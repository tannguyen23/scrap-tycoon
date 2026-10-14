import { D0, Decimal } from '@core/num'
import { currentWeather, incomePerSecond, workerOutputPerUnit } from '@domain/selectors'
import { createFreshState } from '@domain/state'
import { computeProductionRates } from '@domain/systems/production'
import {
  secondsUntilNextBlock,
  weatherAt,
  weatherBlockIndex,
  weatherVisualMix,
  weatherWorkMultiplier,
} from '@domain/weather'
import { describe, expect, it } from 'vitest'
import {
  TEST_CONTENT,
  TEST_WEATHER,
  TEST_WEATHER_CONTENT,
  branchStateOf,
  expectCloseTo,
  findPenalizedTime,
} from './fixtures'

describe('weather schedule', () => {
  it('is a pure function of playTimeS: deterministic and repeatable', () => {
    for (const at of [0, 3.5, 27, 123.456, 99_999]) {
      expect(weatherAt(TEST_WEATHER, at)?.id).toBe(weatherAt(TEST_WEATHER, at)?.id)
    }
    expect(weatherBlockIndex(TEST_WEATHER, -5)).toBe(0)
    expect(weatherBlockIndex(TEST_WEATHER, 0)).toBe(0)
    expect(weatherBlockIndex(TEST_WEATHER, 9.99)).toBe(0)
    expect(weatherBlockIndex(TEST_WEATHER, 10)).toBe(1)
  })

  it('opens with a grace block: the first block always plays the first kind', () => {
    expect(weatherAt(TEST_WEATHER, 0)?.id).toBe('clear')
    expect(weatherAt(TEST_WEATHER, 9.99)?.id).toBe('clear')
    expect(weatherWorkMultiplier(TEST_WEATHER, 5)).toBe(1)
  })

  it('picks later blocks by weight, with every kind reachable', () => {
    const counts = new Map<string, number>()
    for (let block = 1; block < 2000; block++) {
      const kind = weatherAt(TEST_WEATHER, block * TEST_WEATHER.blockSeconds + 1)
      if (!kind) continue
      counts.set(kind.id, (counts.get(kind.id) ?? 0) + 1)
    }
    expect([...counts.keys()].sort()).toEqual(['clear', 'rain', 'storm'])
    expect(counts.get('clear') ?? 0).toBeGreaterThan(counts.get('storm') ?? 0)
    expect(counts.get('rain') ?? 0).toBeGreaterThan(counts.get('storm') ?? 0)
  })

  it('measures the remaining time to the next block boundary', () => {
    expect(secondsUntilNextBlock(TEST_WEATHER, 0)).toBe(10)
    expect(secondsUntilNextBlock(TEST_WEATHER, 3)).toBe(7)
    expect(secondsUntilNextBlock(TEST_WEATHER, 10)).toBe(10)
    expect(secondsUntilNextBlock(TEST_WEATHER, 19.5)).toBeCloseTo(0.5)
  })

  it('blends the previous kind into the current one over the transition window', () => {
    const mixed = weatherVisualMix(TEST_WEATHER, 10)
    expect(mixed).not.toBeNull()
    expect(mixed?.mix).toBe(0)
    expect(mixed?.from).toEqual(weatherAt(TEST_WEATHER, 9.99)?.visual)
    expect(mixed?.to).toEqual(weatherAt(TEST_WEATHER, 10)?.visual)

    expect(weatherVisualMix(TEST_WEATHER, 12)?.mix).toBe(1)
    expect(weatherVisualMix(TEST_WEATHER, 15)?.mix).toBe(1)
    expect(weatherVisualMix(TEST_WEATHER, 0)?.mix).toBe(0)
  })
})

describe('weather modifiers', () => {
  it('slows worker output through the modifier pipeline only when penalized', () => {
    const state = createFreshState(TEST_WEATHER_CONTENT, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 1

    state.stats.playTimeS = 1
    expectCloseTo(computeProductionRates(state, TEST_WEATHER_CONTENT).get('ore') ?? D0, new Decimal(1))

    const penalizedAt = findPenalizedTime(TEST_WEATHER)
    state.stats.playTimeS = penalizedAt
    const multiplier = weatherWorkMultiplier(TEST_WEATHER, penalizedAt)
    expect(multiplier).not.toBe(1)

    expectCloseTo(
      computeProductionRates(state, TEST_WEATHER_CONTENT).get('ore') ?? D0,
      new Decimal(multiplier),
    )
    // HUD honesty: per-worker readout and income agree with the tick rate.
    expectCloseTo(workerOutputPerUnit(state, TEST_WEATHER_CONTENT, 'mine', 'digger'), new Decimal(multiplier))
    expectCloseTo(incomePerSecond(state, TEST_WEATHER_CONTENT), new Decimal(multiplier).mul('0.5'))
  })

  it('stacks with purchased upgrades and leaves recipes untouched', () => {
    const state = createFreshState(TEST_WEATHER_CONTENT, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 1
    branchStateOf(state, 'mine').upgrades['boots'] = true
    state.stats.playTimeS = findPenalizedTime(TEST_WEATHER)

    const multiplier = weatherWorkMultiplier(TEST_WEATHER, state.stats.playTimeS)
    // boots is x2, weather multiplies on top; the sell recipe still pays 0.5 per ore.
    expectCloseTo(incomePerSecond(state, TEST_WEATHER_CONTENT), new Decimal(multiplier).mul(2).mul('0.5'))
  })

  it('changes nothing when the content has no weather profile', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 2
    state.stats.playTimeS = 987_654
    expectCloseTo(incomePerSecond(state, TEST_CONTENT), new Decimal(1))
    expect(currentWeather(TEST_CONTENT, state)).toBeNull()
  })

  it('reports the kind playing right now for the HUD', () => {
    const state = createFreshState(TEST_WEATHER_CONTENT, new Decimal(0))
    state.stats.playTimeS = findPenalizedTime(TEST_WEATHER)
    const kind = currentWeather(TEST_WEATHER_CONTENT, state)
    expect(kind).not.toBeNull()
    expect(kind?.id).toBe(weatherAt(TEST_WEATHER, state.stats.playTimeS)?.id)
  })
})
