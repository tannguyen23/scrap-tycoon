export type ThemeMode = 'light' | 'dark'

export function isThemeMode(value: string): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

/**
 * Pure observable holding the active theme. Applying it to the document and
 * persisting the choice happens in the app layer (same pattern as LocaleStore).
 */
export class ThemeStore {
  private mode: ThemeMode
  private readonly listeners = new Set<() => void>()

  constructor(initial: ThemeMode) {
    this.mode = initial
  }

  get = (): ThemeMode => this.mode

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  set = (mode: ThemeMode): void => {
    if (mode === this.mode) return
    this.mode = mode
    for (const listener of this.listeners) listener()
  }
}
