export const SAVE_VERSION = 5

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
  /**
   * The player's bag as a fixed-length list of slots, `null` for an empty one.
   * The bag belongs to no zone, so it is its own section instead of sharing the
   * `stock` map — and the slots (gaps included) are kept so the player's
   * arrangement survives a reload.
   */
  bag: ({ item: string; amount: string } | null)[]
  /** Gear the player owns by id — owning a piece is wearing it. */
  gear: Record<string, true>
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
