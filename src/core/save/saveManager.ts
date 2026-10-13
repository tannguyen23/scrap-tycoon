import { migrateSave } from './migrations'
import { isSaveFile, SAVE_VERSION, type SaveFile, type SerializedState } from './schema'
import type { StoragePort } from './storage-port'

const DEFAULT_KEY = 'save'

/**
 * Reads/writes versioned save files through a StoragePort. It only cares about
 * the serialized shape — mapping to/from the live game state is a domain concern.
 */
export class SaveManager {
  private readonly storage: StoragePort
  private readonly key: string

  constructor(storage: StoragePort, key: string = DEFAULT_KEY) {
    this.storage = storage
    this.key = key
  }

  static createSave(state: SerializedState, savedAt: number): SaveFile {
    return { schemaVersion: SAVE_VERSION, savedAt, state }
  }

  write(state: SerializedState, savedAt: number): void {
    this.storage.set(this.key, JSON.stringify(SaveManager.createSave(state, savedAt)))
  }

  /** Returns null for missing, corrupted or unmigratable saves. */
  read(): SaveFile | null {
    const raw = this.storage.get(this.key)
    if (raw === null) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.warn('[save] ignoring corrupted save: not valid JSON')
      return null
    }
    if (!isSaveFile(parsed)) {
      console.warn('[save] ignoring corrupted save: unexpected shape')
      return null
    }
    const migrated = migrateSave(parsed, SAVE_VERSION)
    if (migrated === null || !isSaveFile(migrated)) {
      console.warn('[save] ignoring save: no migration path to current version')
      return null
    }
    return migrated
  }

  clear(): void {
    this.storage.remove(this.key)
  }
}
