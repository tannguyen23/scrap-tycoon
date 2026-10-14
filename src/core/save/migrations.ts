export type Migration = (save: Record<string, unknown>) => Record<string, unknown>

/**
 * Key N migrates a save of schema version N to version N + 1.
 *
 * v1 → v2: the single `resources` pool splits into global `resources` plus a
 * flat `stock` warehouse section. This layer sits below content and cannot know
 * which item belongs to which zone, so it moves the entries verbatim; the
 * domain hydrate step routes them into zone buckets using the content mapping.
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
