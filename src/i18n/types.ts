export type Locale = 'vi' | 'en'

export const LOCALES: readonly Locale[] = ['vi', 'en']

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * A localized string must carry every supported locale — TypeScript reports
 * missing translations at compile time when a new locale is added.
 */
export type L10n = Record<Locale, string>

export function t(text: L10n, locale: Locale, params?: Record<string, string>): string {
  let result = text[locale]
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      result = result.replaceAll(`{${key}}`, value)
    }
  }
  return result
}
