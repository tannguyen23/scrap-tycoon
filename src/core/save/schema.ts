export const SAVE_VERSION = 2

export interface SerializedBranchState {
  workers: Record<string, number>
  upgrades: Record<string, true>
}

export interface SerializedState {
  /** Global pool: the currency and any item not stored in a zone warehouse. */
  resources: Record<string, string>
  /**
   * Zone warehouse stock, flattened by item id. Which zone holds an item is
   * content data (`domain/zones.ts`), so the file never bakes a zone in —
   * moving an item between zones in content keeps every old save valid.
   */
  stock: Record<string, string>
  branches: Record<string, SerializedBranchState>
  stats: {
    totalEarned: string
    playTimeS: number
  }
}

export interface SaveFile {
  schemaVersion: number
  savedAt: number
  state: SerializedState
}

/** Loose structural check; deep pruning/repair is done by the domain hydrate step. */
export function isSaveFile(value: unknown): value is SaveFile {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SaveFile>
  return (
    typeof candidate.schemaVersion === 'number' &&
    typeof candidate.savedAt === 'number' &&
    typeof candidate.state === 'object' &&
    candidate.state !== null
  )
}
