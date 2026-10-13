/**
 * Port for persistence. Implemented by platform adapters
 * (localStorage today, Tauri filesystem later) and by an in-memory
 * adapter in tests.
 */
export interface StoragePort {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}
