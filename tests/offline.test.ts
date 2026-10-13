import { Decimal } from '@core/num'
import { createFreshState, getResource } from '@domain/state'
import { applyOfflineProgress } from '@domain/systems/offline'
import { runTick } from '@domain/tick'
import { describe, expect, it } from 'vitest'
import { TEST_CONTENT, branchStateOf, expectCloseTo } from './fixtures'

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
})
