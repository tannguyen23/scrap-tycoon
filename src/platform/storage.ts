import type { StoragePort } from '@core/save/storage-port'

const PREFIX = 'scrap-tycoon:'

/** Browser localStorage adapter; tolerates private-mode / blocked storage. */
export class LocalStorageAdapter implements StoragePort {
  private readonly prefix: string

  constructor(prefix: string = PREFIX) {
    this.prefix = prefix
  }

  get(key: string): string | null {
    try {
      return window.localStorage.getItem(this.prefix + key)
    } catch {
      return null
    }
  }

  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(this.prefix + key, value)
    } catch (error) {
      console.warn('[storage] failed to persist', error)
    }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(this.prefix + key)
    } catch (error) {
      console.warn('[storage] failed to remove', error)
    }
  }
}

/** In-memory adapter for tests and non-browser environments. */
export class MemoryStorageAdapter implements StoragePort {
  private readonly data = new Map<string, string>()

  get(key: string): string | null {
    return this.data.get(key) ?? null
  }

  set(key: string, value: string): void {
    this.data.set(key, value)
  }

  remove(key: string): void {
    this.data.delete(key)
  }
}
