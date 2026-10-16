import { Decimal } from '@core/num'
import { migrateSave, migrations } from '@core/save/migrations'
import { SAVE_VERSION, isSaveFile } from '@core/save/schema'
import { SaveManager } from '@core/save/saveManager'
import { createFreshState, getBag, stateFromSerialized, stateToSerialized } from '@domain/state'
import { MemoryStorageAdapter } from '@platform/storage'
import { afterEach, describe, expect, it } from 'vitest'
import { TEST_CONTENT, branchStateOf, emptyBagSlots, expectCloseTo, seedBag } from './fixtures'

describe('serialization roundtrip', () => {
  it('roundtrips resources including huge Decimal values', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal('1e1000'))
    state.stock['mine'] = { ...(state.stock['mine'] ?? {}), ore: new Decimal('123.456') }
    seedBag(state, TEST_CONTENT, 'ore', new Decimal('7.5'))
    state.gear['vest'] = true
    branchStateOf(state, 'mine').workers['digger'] = 7
    branchStateOf(state, 'mine').upgrades['boots'] = true
    state.stats.totalEarned = new Decimal('4.2e15')
    state.stats.playTimeS = 1234

    const restored = stateFromSerialized(stateToSerialized(state), TEST_CONTENT, new Decimal(0))

    expect(restored.warnings).toEqual([])
    expectCloseTo(restored.state.resources['money'] ?? new Decimal(0), new Decimal('1e1000'))
    // Zone items live in their warehouse, not in the global pool.
    expect(restored.state.resources['ore']).toBeUndefined()
    expect(restored.state.stock['mine']?.['ore']?.eq(new Decimal('123.456'))).toBe(true)
    // The bag is its own section — what the player carries is not warehouse stock.
    expectCloseTo(getBag(restored.state, 'ore'), new Decimal('7.5'))
    // …and so is the gear the character owns.
    expect(restored.state.gear['vest']).toBe(true)
    expect(restored.state.branches['mine']?.workers['digger']).toBe(7)
    expect(restored.state.branches['mine']?.upgrades['boots']).toBe(true)
    expect(restored.state.stats.totalEarned.eq(new Decimal('4.2e15'))).toBe(true)
    expect(restored.state.stats.playTimeS).toBe(1234)
  })

  it('keeps the bag arrangement (slot gaps) across a roundtrip', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal(0))
    state.bag[2] = { item: 'ore', amount: new Decimal(3) }

    const restored = stateFromSerialized(stateToSerialized(state), TEST_CONTENT, new Decimal(0))

    expect(restored.warnings).toEqual([])
    expect(restored.state.bag[2]?.item).toBe('ore')
    expect(restored.state.bag[0]).toBeNull()
    expect(restored.state.bag.filter((slot) => slot !== null)).toHaveLength(1)
  })

  it('prunes unknown ids and fills missing content ids', () => {
    const serialized = stateToSerialized(createFreshState(TEST_CONTENT, new Decimal(5)))
    serialized.stock['gold'] = '99' // unknown item → pruned
    serialized.stock['ore'] = 'not-a-number' // invalid value → dropped
    serialized.bag.push({ item: 'gold', amount: '99' }) // unknown item in the bag → pruned
    serialized.bag.push({ item: 'ore', amount: 'not-a-number' }) // invalid bag value → dropped
    serialized.gear['jetpack'] = true // unknown gear → pruned
    serialized.branches['quarry'] = { workers: {}, upgrades: {} } // unknown branch → pruned

    const restored = stateFromSerialized(serialized, TEST_CONTENT, new Decimal(0))

    expect(restored.warnings.length).toBeGreaterThan(0)
    expect(restored.state.resources['gold']).toBeUndefined()
    expect(restored.state.stock['mine']?.['gold']).toBeUndefined()
    expectCloseTo(getBag(restored.state, 'gold'), new Decimal(0))
    expect(restored.state.gear['jetpack']).toBeUndefined()
    expectCloseTo(restored.state.stock['mine']?.['ore'] ?? new Decimal(0), new Decimal(0))
    expectCloseTo(getBag(restored.state, 'ore'), new Decimal(0))
    expectCloseTo(restored.state.resources['money'] ?? new Decimal(0), new Decimal(5))
    expect(restored.state.branches['quarry']).toBeUndefined()
    expect(restored.state.branches['mine']?.workers['drill']).toBeUndefined()
  })

  it('migrates a v1 save into per-zone warehouses', () => {
    const legacy = {
      schemaVersion: 1,
      savedAt: 0,
      state: {
        resources: { money: '5', ore: '123.456' },
        branches: { mine: { workers: { digger: 1 }, upgrades: {} } },
        stats: { totalEarned: '0', playTimeS: 10 },
      },
    }

    const migrated = migrateSave(legacy, SAVE_VERSION)

    expect(migrated).not.toBeNull()
    if (!migrated || !isSaveFile(migrated)) throw new Error('expected a migratable save')
    const restored = stateFromSerialized(migrated.state, TEST_CONTENT, new Decimal(0))

    expect(restored.warnings).toEqual([])
    // The currency stays global; the ore lands in its zone's warehouse.
    expectCloseTo(restored.state.resources['money'] ?? new Decimal(0), new Decimal(5))
    expectCloseTo(restored.state.stock['mine']?.['ore'] ?? new Decimal(0), new Decimal('123.456'))
    expect(restored.state.branches['mine']?.workers['digger']).toBe(1)
  })

  it('gives a v3 save (which predates gear) an empty gear set', () => {
    const legacy = {
      schemaVersion: 3,
      savedAt: 0,
      state: {
        resources: { money: '5' },
        stock: { ore: '12' },
        bag: { ore: '2' },
        branches: { mine: { workers: { digger: 1 }, upgrades: {} } },
        stats: { totalEarned: '0', playTimeS: 10 },
      },
    }

    const migrated = migrateSave(legacy, SAVE_VERSION)

    expect(migrated?.['schemaVersion']).toBe(SAVE_VERSION)
    if (!migrated || !isSaveFile(migrated)) throw new Error('expected a migratable save')
    const restored = stateFromSerialized(migrated.state, TEST_CONTENT, new Decimal(0))

    expect(restored.warnings).toEqual([])
    expect(restored.state.gear).toEqual({})
    // The sections that already existed are untouched.
    expectCloseTo(getBag(restored.state, 'ore'), new Decimal(2))
    expectCloseTo(restored.state.stock['mine']?.['ore'] ?? new Decimal(0), new Decimal(12))
  })

  it('migrates a v4 save (record-shaped bag) into slots', () => {
    const legacy = {
      schemaVersion: 4,
      savedAt: 0,
      state: {
        resources: { money: '5' },
        stock: { ore: '12' },
        bag: { ore: '25' },
        gear: { vest: true },
        branches: { mine: { workers: {}, upgrades: {} } },
        stats: { totalEarned: '0', playTimeS: 10 },
      },
    }

    const migrated = migrateSave(legacy, SAVE_VERSION)

    expect(migrated?.['schemaVersion']).toBe(SAVE_VERSION)
    if (!migrated || !isSaveFile(migrated)) throw new Error('expected a migratable save')
    const restored = stateFromSerialized(migrated.state, TEST_CONTENT, new Decimal(0))

    expect(restored.warnings).toEqual([])
    // 25 ore is past the per-slot ceiling (carry 20), so it splits into two slots.
    expectCloseTo(getBag(restored.state, 'ore'), new Decimal(25))
    expect(restored.state.bag.filter((slot) => slot?.item === 'ore')).toHaveLength(2)
    expect(restored.state.gear['vest']).toBe(true)
  })

  it('gives a v2 save (which predates the bag) an empty one', () => {
    const legacy = {
      schemaVersion: 2,
      savedAt: 0,
      state: {
        resources: { money: '5' },
        stock: { ore: '12' },
        branches: { mine: { workers: { digger: 1 }, upgrades: {} } },
        stats: { totalEarned: '0', playTimeS: 10 },
      },
    }

    const migrated = migrateSave(legacy, SAVE_VERSION)

    expect(migrated?.['schemaVersion']).toBe(SAVE_VERSION)
    if (!migrated || !isSaveFile(migrated)) throw new Error('expected a migratable save')
    const restored = stateFromSerialized(migrated.state, TEST_CONTENT, new Decimal(0))

    expect(restored.warnings).toEqual([])
    expect(restored.state.bag).toEqual(emptyBagSlots(TEST_CONTENT))
    expectCloseTo(restored.state.stock['mine']?.['ore'] ?? new Decimal(0), new Decimal(12))
    expectCloseTo(restored.state.resources['money'] ?? new Decimal(0), new Decimal(5))
  })
})

describe('SaveManager', () => {
  it('writes and reads a save through the storage port', () => {
    const storage = new MemoryStorageAdapter()
    const manager = new SaveManager(storage)
    const state = createFreshState(TEST_CONTENT, new Decimal(42))

    manager.write(stateToSerialized(state), 1000)
    const file = manager.read()

    expect(file?.schemaVersion).toBe(SAVE_VERSION)
    expect(file?.savedAt).toBe(1000)
    expect(file?.state.resources['money']).toBe('42')
    expect(file?.state.stock['ore']).toBe('0')
    expect(file?.state.bag).toEqual(emptyBagSlots(TEST_CONTENT))
    expect(file?.state.gear).toEqual({})
  })

  it('returns null for corrupted JSON', () => {
    const storage = new MemoryStorageAdapter()
    const manager = new SaveManager(storage)
    storage.set('save', '{oops')
    expect(manager.read()).toBeNull()
  })

  it('returns null for unexpected shapes', () => {
    const storage = new MemoryStorageAdapter()
    const manager = new SaveManager(storage)
    storage.set('save', JSON.stringify({ hello: 'world' }))
    expect(manager.read()).toBeNull()
  })

  it('clears the save', () => {
    const storage = new MemoryStorageAdapter()
    const manager = new SaveManager(storage)
    manager.write(stateToSerialized(createFreshState(TEST_CONTENT, new Decimal(1))), 0)
    manager.clear()
    expect(manager.read()).toBeNull()
  })
})

describe('migration runner', () => {
  // Restored after each test so temporary stubs never clobber the real chain.
  const originalMigrations = { ...migrations }

  afterEach(() => {
    for (const key of Object.keys(migrations)) delete migrations[Number(key)]
    Object.assign(migrations, originalMigrations)
  })

  it('runs migrations in order up to the target version', () => {
    migrations[0] = (save) => ({
      ...save,
      state: { ...(save['state'] as Record<string, unknown>), addedAtV0: true },
    })
    migrations[1] = (save) => ({
      ...save,
      state: { ...(save['state'] as Record<string, unknown>), addedAtV1: true },
    })

    const migrated = migrateSave({ schemaVersion: 0, savedAt: 0, state: {} }, 2)

    expect(migrated?.['schemaVersion']).toBe(2)
    const state = migrated?.['state'] as Record<string, unknown>
    expect(state['addedAtV0']).toBe(true)
    expect(state['addedAtV1']).toBe(true)
  })

  it('returns null when no migration path exists', () => {
    expect(migrateSave({ schemaVersion: 0, savedAt: 0, state: {} }, 1)).toBeNull()
    expect(migrateSave({ schemaVersion: 9, savedAt: 0, state: {} }, 1)).toBeNull()
    expect(migrateSave('nope', 1)).toBeNull()
  })

  it('passes current-version saves through untouched', () => {
    const save = { schemaVersion: 1, savedAt: 0, state: {} }
    expect(migrateSave(save, 1)).toEqual(save)
  })
})
