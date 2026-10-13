import { createContext, useContext, useSyncExternalStore } from 'react'
import type { EngineApi } from '@domain/engine-api'
import type { GameContent, GameState } from '@domain/types'
import type { LocaleStore } from '@i18n/locale'
import { t, type L10n, type Locale } from '@i18n/types'

export const EngineContext = createContext<EngineApi | null>(null)
export const ContentContext = createContext<GameContent | null>(null)
export const LocaleContext = createContext<LocaleStore | null>(null)

export type TranslateFn = (text: L10n, params?: Record<string, string>) => string

export function useEngine(): EngineApi {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('EngineContext is missing')
  return engine
}

export function useContent(): GameContent {
  const content = useContext(ContentContext)
  if (!content) throw new Error('ContentContext is missing')
  return content
}

export function useLocaleStore(): LocaleStore {
  const localeStore = useContext(LocaleContext)
  if (!localeStore) throw new Error('LocaleContext is missing')
  return localeStore
}

export function useLocale(): Locale {
  const localeStore = useLocaleStore()
  return useSyncExternalStore(localeStore.subscribe, localeStore.get)
}

export function useGameState(): GameState {
  const engine = useEngine()
  return useSyncExternalStore(engine.store.subscribe, engine.store.getSnapshot)
}

/** Translate helper bound to the active locale. */
export function useText(): TranslateFn {
  const locale = useLocale()
  return (text: L10n, params?: Record<string, string>) => t(text, locale, params)
}
