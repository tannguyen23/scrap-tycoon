import { Decimal } from '@core/num'
import { migrateSave, migrations } from '@core/save/migrations'
import { SAVE_VERSION, isSaveFile } from '@core/save/schema'
import { SaveManager } from '@core/save/saveManager'
import { createFreshState, stateFromSerialized, stateToSerialized } from '@domain/state'
import { MemoryStorageAdapter } from '@platform/storage'
import { afterEach, describe, expect, it } from 'vitest'
import { TEST_CONTENT, branchStateOf, expectCloseTo } from './fixtures'

describe('serialization roundtrip', () => {
  it('roundtrips resources including huge Decimal values', () => {
    const state = createFreshState(TEST_CONTENT, new Decimal('1e1000'))
    state.stock['mine'] = { ...(state.stock['mine'] ?? {}), ore: new Decimal('123.456') }
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
    expect(restored.state.branches['mine']?.workers['digger']).toBe(7)
    expect(restored.state.branches['mine']?.upgrades['boots']).toBe(true)
    expect(restored.state.stats.totalEarned.eq(new Decimal('4.2e15'))).toBe(true)
    expect(restored.state.stats.playTimeS).toBe(1234)
  })

  it('prunes unknown ids and fills missing content ids', () => {
    const serialized = stateToSerialized(createFreshState(TEST_CONTENT, new Decimal(5)))
    serialized.stock['gold'] = '99' // unknown item → pruned
    serialized.stock['ore'] = 'not-a-number' // invalid value → dropped
    serialized.branches['quarry'] = { workers: {}, upgrades: {} } // unknown branch → pruned

    const restored = stateFromSerialized(serialized, TEST_CONTENT, new Decimal(0))

    expect(restored.warnings.length).toBeGreaterThan(0)
    expect(restored.state.resources['gold']).toBeUndefined()
    expect(restored.state.stock['mine']?.['gold']).toBeUndefined()
    expectCloseTo(restored.state.stock['mine']?.['ore'] ?? new Decimal(0), new Decimal(0))
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
