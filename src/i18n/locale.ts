import type { Locale } from './types'

export function detectLocale(navigatorLanguage: string): Locale {
  return navigatorLanguage.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

/**
 * Pure observable holding the active locale. Reading the browser language and
 * persisting the choice happens in the app layer, keeping this module free of
 * platform APIs.
 */
export class LocaleStore {
  private locale: Locale
  private readonly listeners = new Set<() => void>()

  constructor(initial: Locale) {
    this.locale = initial
  }

  get = (): Locale => this.locale

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  set = (locale: Locale): void => {
    if (locale === this.locale) return
    this.locale = locale
    for (const listener of this.listeners) listener()
  }
}
