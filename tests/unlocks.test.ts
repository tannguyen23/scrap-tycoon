import { GAME_CONTENT } from '@content/index'
import { Decimal } from '@core/num'
import { buyUpgrade, buyWorker } from '@domain/commands'
import { isUpgradeUnlocked, isWorkerUnlocked, isZoneUnlocked } from '@domain/conditions'
import { createFreshState } from '@domain/state'
import { describe, expect, it } from 'vitest'
import { branchStateOf } from './fixtures'

const BRANCH = 'scrap'

describe('chain gating of the scrap yard', () => {
  it('opens the alley first and keeps the next zones locked', () => {
    const state = createFreshState(GAME_CONTENT, new Decimal(1000))
    expect(isZoneUnlocked(state, GAME_CONTENT, 'alley')).toBe(true)
    expect(isZoneUnlocked(state, GAME_CONTENT, 'recycle')).toBe(false)
    expect(isZoneUnlocked(state, GAME_CONTENT, 'route')).toBe(false)
    expect(isZoneUnlocked(state, GAME_CONTENT, 'depot')).toBe(false)
    expect(isZoneUnlocked(state, GAME_CONTENT, 'gate')).toBe(false)
    expect(isWorkerUnlocked(state, GAME_CONTENT, BRANCH, 'porter')).toBe(true)
    expect(isWorkerUnlocked(state, GAME_CONTENT, BRANCH, 'smelter')).toBe(false)
    expect(isWorkerUnlocked(state, GAME_CONTENT, BRANCH, 'truck')).toBe(false)
  })

  it('refuses locked purchases without touching the wallet or the branch', () => {
    const state = createFreshState(GAME_CONTENT, new Decimal(1000))
    const moneyBefore = state.resources['money']?.toString()

    const worker = buyWorker(state, GAME_CONTENT, BRANCH, 'smelter', 1)
    expect(worker.ok).toBe(false)
    if (!worker.ok) expect(worker.reason).toBe('locked')
    expect(state.resources['money']?.toString()).toBe(moneyBefore)
    expect(branchStateOf(state, BRANCH).workers['smelter']).toBeUndefined()

    const upgrade = buyUpgrade(state, GAME_CONTENT, BRANCH, 'bellows')
    expect(upgrade.ok).toBe(false)
    if (!upgrade.ok) expect(upgrade.reason).toBe('locked')
    expect(state.resources['money']?.toString()).toBe(moneyBefore)
    expect(branchStateOf(state, BRANCH).upgrades['bellows']).toBeUndefined()
  })

  it('unlocks each zone as soon as the step before it is staffed', () => {
    const state = createFreshState(GAME_CONTENT, new Decimal(1_000_000))
    const workers = branchStateOf(state, BRANCH).workers

    expect(buyWorker(state, GAME_CONTENT, BRANCH, 'porter', 1).ok).toBe(true)
    expect(isZoneUnlocked(state, GAME_CONTENT, 'recycle')).toBe(true)
    expect(buyWorker(state, GAME_CONTENT, BRANCH, 'smelter', 1).ok).toBe(true)
    expect(isZoneUnlocked(state, GAME_CONTENT, 'route')).toBe(true)
    expect(buyWorker(state, GAME_CONTENT, BRANCH, 'cart', 1).ok).toBe(true)
    expect(isZoneUnlocked(state, GAME_CONTENT, 'depot')).toBe(true)
    expect(buyWorker(state, GAME_CONTENT, BRANCH, 'depot', 1).ok).toBe(true)
    expect(isZoneUnlocked(state, GAME_CONTENT, 'gate')).toBe(true)
    expect(buyWorker(state, GAME_CONTENT, BRANCH, 'truck', 1).ok).toBe(true)
    expect(workers['porter']).toBe(1)
  })

  it('keeps owned workers of an old save even when their zone gate is unmet', () => {
    const state = createFreshState(GAME_CONTENT, new Decimal(1_000_000))
    // A save from before the gates existed: a smelter but no porter.
    branchStateOf(state, BRANCH).workers['smelter'] = 3

    expect(isZoneUnlocked(state, GAME_CONTENT, 'recycle')).toBe(false)
    expect(branchStateOf(state, BRANCH).workers['smelter']).toBe(3)
    // Expanding the dead-end step waits for the chain to be staffed…
    const worker = buyWorker(state, GAME_CONTENT, BRANCH, 'smelter', 1)
    expect(worker.ok).toBe(false)
    if (!worker.ok) expect(worker.reason).toBe('locked')
    // …but the step that gates it stays buyable.
    expect(buyWorker(state, GAME_CONTENT, BRANCH, 'porter', 1).ok).toBe(true)
    expect(buyWorker(state, GAME_CONTENT, BRANCH, 'smelter', 1).ok).toBe(true)
  })

  it('gates step upgrades behind their own worker', () => {
    const state = createFreshState(GAME_CONTENT, new Decimal(1_000_000))
    expect(isUpgradeUnlocked(state, GAME_CONTENT, BRANCH, 'belt')).toBe(true)
    expect(isUpgradeUnlocked(state, GAME_CONTENT, BRANCH, 'handcart')).toBe(false)

    branchStateOf(state, BRANCH).workers['porter'] = 1
    expect(isUpgradeUnlocked(state, GAME_CONTENT, BRANCH, 'handcart')).toBe(true)
    expect(buyUpgrade(state, GAME_CONTENT, BRANCH, 'handcart').ok).toBe(true)
  })

  it('keeps the route fleet upgrades in order', () => {
    const state = createFreshState(GAME_CONTENT, new Decimal(1_000_000))
    branchStateOf(state, BRANCH).workers['cart'] = 1

    expect(buyUpgrade(state, GAME_CONTENT, BRANCH, 'box-truck').ok).toBe(false)
    expect(buyUpgrade(state, GAME_CONTENT, BRANCH, 'pickup').ok).toBe(true)
    expect(buyUpgrade(state, GAME_CONTENT, BRANCH, 'box-truck').ok).toBe(true)
  })
})
