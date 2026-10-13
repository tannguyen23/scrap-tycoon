export type Migration = (save: Record<string, unknown>) => Record<string, unknown>

/**
 * Key N migrates a save of schema version N to version N + 1.
 * Empty at v1 — the runner is here so future content/state changes never
 * break existing player saves.
 */
export const migrations: Record<number, Migration> = {}

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
