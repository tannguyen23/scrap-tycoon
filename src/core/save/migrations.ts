export type Migration = (save: Record<string, unknown>) => Record<string, unknown>

/**
 * Key N migrates a save of schema version N to version N + 1.
 *
 * v1 → v2: the single `resources` pool splits into global `resources` plus a
 * flat `stock` warehouse section. This layer sits below content and cannot know
 * which item belongs to which zone, so it moves the entries verbatim; the
 * domain hydrate step routes them into zone buckets using the content mapping.
 *
 * v2 → v3: the player's bag becomes a section of its own. Older saves predate
 * the bag entirely, so they get an empty one.
 *
 * v3 → v4: gear the player owns. Older saves predate it, so nobody owns anything.
 *
 * v4 → v5: the bag turns from a flat item → amount record into a slot list. One
 * entry per carried item (verbatim, in iteration order); the domain hydrate then
 * re-lays them into slots, splitting any stack past the item's ceiling.
 */
export const migrations: Record<number, Migration> = {
  1: (save) => {
    const state = isRecord(save['state']) ? save['state'] : {}
    const resources = isRecord(state['resources']) ? state['resources'] : {}
    return {
      ...save,
      state: { ...state, resources: {}, stock: { ...resources } },
    }
  },
  2: (save) => {
    const state = isRecord(save['state']) ? save['state'] : {}
    return {
      ...save,
      state: { ...state, bag: isRecord(state['bag']) ? state['bag'] : {} },
    }
  },
  3: (save) => {
    const state = isRecord(save['state']) ? save['state'] : {}
    return {
      ...save,
      state: { ...state, gear: isRecord(state['gear']) ? state['gear'] : {} },
    }
  },
  4: (save) => {
    const state = isRecord(save['state']) ? save['state'] : {}
    const oldBag = isRecord(state['bag']) ? state['bag'] : {}
    const bag = Object.entries(oldBag).map(([item, amount]) => ({ item, amount }))
    return { ...save, state: { ...state, bag } }
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Runs migrations up to `targetVersion`; returns null when no path exists. */
export function migrateSave(raw: unknown, targetVersion: number): Record<string, unknown> | null {
  if (!isRecord(raw)) return null
  let current: Record<string, unknown> = { ...raw }
  let version = typeof current['schemaVersion'] === 'number' ? (current['schemaVersion'] as number) : -1
  if (version < 0 || version > targetVersion) return null
  while (version < targetVersion) {
    const migration = migrations[version]
    if (!migration) return null
    current = migration(current)
    version += 1
    current['schemaVersion'] = version
  }
  return current
}
