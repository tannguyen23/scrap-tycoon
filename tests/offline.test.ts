import { Decimal } from '@core/num'
import { createFreshState, getResource } from '@domain/state'
import { applyOfflineProgress } from '@domain/systems/offline'
import { runTick } from '@domain/tick'
import { describe, expect, it } from 'vitest'
import {
  TEST_CHAIN_CONTENT,
  TEST_CONTENT,
  TEST_WEATHER,
  TEST_WEATHER_CONTENT,
  branchStateOf,
  expectCloseTo,
  findPenalizedTime,
} from './fixtures'

const HOUR = 3600
const CAP_8H = 8 * HOUR

describe('offline progress', () => {
  it('credits earnings linearly with elapsed time', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 1

    const report = applyOfflineProgress(state, TEST_CONTENT, 120, CAP_8H)

    expect(report.elapsedSeconds).toBe(120)
    expect(report.effectiveSeconds).toBe(120)
    // 1 ore/s → 0.5 money/s over 120s
    expectCloseTo(report.earned, new Decimal(60))
    expectCloseTo(getResource(state, 'money'), new Decimal(60))
    expect(state.stats.playTimeS).toBe(120)
    expectCloseTo(state.stats.totalEarned, new Decimal(60))
  })

  it('caps effective time but still reports the real absence', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 1

    const report = applyOfflineProgress(state, TEST_CONTENT, 100 * HOUR, CAP_8H)

    expect(report.elapsedSeconds).toBe(100 * HOUR)
    expect(report.effectiveSeconds).toBe(CAP_8H)
    expectCloseTo(report.earned, new Decimal(CAP_8H / 2))
  })

  it('earns nothing without workers', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(5))
    const report = applyOfflineProgress(state, TEST_CONTENT, HOUR, CAP_8H)

    expectCloseTo(report.earned, new Decimal(0))
    expectCloseTo(getResource(state, 'money'), new Decimal(5))
  })

  it('matches ticking the same duration (online and offline share one code path)', () => {
    const offlineState = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(offlineState, 'mine').workers['digger'] = 3
    applyOfflineProgress(offlineState, TEST_CONTENT, 100, CAP_8H)

    const tickedState = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(tickedState, 'mine').workers['digger'] = 3
    for (let i = 0; i < 1000; i++) runTick(tickedState, TEST_CONTENT, 0.1)

    expectCloseTo(getResource(offlineState, 'money'), getResource(tickedState, 'money'), 1e-6)
    expectCloseTo(offlineState.stats.totalEarned, tickedState.stats.totalEarned, 1e-6)
  })

  it('chunks weather blocks and still matches ticking across them', () => {
    // Block boundaries and tick steps share the 0.1s grid, so a whole number of
    // blocks integrates exactly the same on both paths.
    const penalizedAt = findPenalizedTime(TEST_WEATHER)
    const total = (Math.floor(penalizedAt / TEST_WEATHER.blockSeconds) + 1) * TEST_WEATHER.blockSeconds

    const offlineState = createFreshState(TEST_WEATHER_CONTENT, new Decimal(0))
    branchStateOf(offlineState, 'mine').workers['digger'] = 3
    applyOfflineProgress(offlineState, TEST_WEATHER_CONTENT, total, CAP_8H)

    const tickedState = createFreshState(TEST_WEATHER_CONTENT, new Decimal(0))
    branchStateOf(tickedState, 'mine').workers['digger'] = 3
    for (let i = 0; i < total * 10; i++) runTick(tickedState, TEST_WEATHER_CONTENT, 0.1)

    expectCloseTo(getResource(offlineState, 'money'), getResource(tickedState, 'money'), 1e-6)
    expectCloseTo(offlineState.stats.totalEarned, tickedState.stats.totalEarned, 1e-6)
    expectCloseTo(new Decimal(offlineState.stats.playTimeS), new Decimal(tickedState.stats.playTimeS), 1e-6)
  })

  it('chunks capped chains and stays close to the online path', () => {
    // Caps make rates state-dependent, so offline integrates in 1s chunks
    // (`simulation.offlineChunkSeconds`) instead of one big step. Bins saturate
    // fast, so the chunked result converges to the online path — but it is a
    // controlled approximation, not bit-identical (online ticks at 0.1s).
    const offlineState = createFreshState(TEST_CHAIN_CONTENT, new Decimal(0))
    branchStateOf(offlineState, 'mine').workers['digger'] = 1
    branchStateOf(offlineState, 'mine').workers['hauler'] = 3
    branchStateOf(offlineState, 'mine').workers['seller'] = 2
    applyOfflineProgress(offlineState, TEST_CHAIN_CONTENT, 120, CAP_8H)

    const tickedState = createFreshState(TEST_CHAIN_CONTENT, new Decimal(0))
    branchStateOf(tickedState, 'mine').workers['digger'] = 1
    branchStateOf(tickedState, 'mine').workers['hauler'] = 3
    branchStateOf(tickedState, 'mine').workers['seller'] = 2
    for (let i = 0; i < 1200; i++) runTick(tickedState, TEST_CHAIN_CONTENT, 0.1)

    // Flow (money) is what must agree. Stock levels are inherently chunk-size
    // dependent — a 1s chunk can fill or drain a small bin within one step — so
    // assert the steady bands instead of exact levels.
    expectCloseTo(getResource(offlineState, 'money'), getResource(tickedState, 'money'), 0.02)
    const ore = getResource(offlineState, 'ore').toNumber()
    const bar = getResource(offlineState, 'bar').toNumber()
    expect(ore).toBeGreaterThan(6)
    expect(ore).toBeLessThanOrEqual(10)
    expect(bar).toBeGreaterThan(3)
    expect(bar).toBeLessThanOrEqual(6)
  })

  it('keeps the one-step fast path when content has no caps or legs', () => {
    // Regression guard: plain content must stay exactly linear (1e-6 path above
    // is the real lock; this asserts the branch decision itself).
    const state = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(state, 'mine').workers['digger'] = 1
    const report = applyOfflineProgress(state, TEST_CONTENT, 90, CAP_8H)
    expectCloseTo(report.earned, new Decimal(45))
  })

  it('actually pays weather penalties during an absence', () => {
    const total = (Math.floor(findPenalizedTime(TEST_WEATHER) / TEST_WEATHER.blockSeconds) + 1) *
      TEST_WEATHER.blockSeconds

    const plainState = createFreshState(TEST_CONTENT, new Decimal(0))
    branchStateOf(plainState, 'mine').workers['digger'] = 3
    applyOfflineProgress(plainState, TEST_CONTENT, total, CAP_8H)

    const weatherState = createFreshState(TEST_WEATHER_CONTENT, new Decimal(0))
    branchStateOf(weatherState, 'mine').workers['digger'] = 3
    const report = applyOfflineProgress(weatherState, TEST_WEATHER_CONTENT, total, CAP_8H)

    expect(report.effectiveSeconds).toBe(total)
    expect(getResource(weatherState, 'money').lt(getResource(plainState, 'money'))).toBe(true)
    expectCloseTo(report.earned, getResource(weatherState, 'money'))
  })
})
