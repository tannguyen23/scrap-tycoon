import type { Decimal } from '@core/num'
import type { EngineApi } from '@domain/engine-api'
import type { GameContent, GameState, WorkPose } from '@domain/types'
import type { LocaleStore } from '@i18n/locale'
import { t, type L10n, type Locale } from '@i18n/types'
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PlayerReadout } from './scene/player'
import type { SoundSettings, SoundStore } from './sound/settings'
import type { ThemeMode, ThemeStore } from './theme'

export const EngineContext = createContext<EngineApi | null>(null)
export const ContentContext = createContext<GameContent | null>(null)
export const LocaleContext = createContext<LocaleStore | null>(null)
export const ThemeContext = createContext<ThemeStore | null>(null)
export const SoundContext = createContext<SoundStore | null>(null)

export interface SceneBridge {
  /** Outline a zone on the map while its HUD card is hovered. */
  highlight: (zoneId: string | null) => void
  /** Move the camera to a zone (HUD card click). */
  panTo: (zoneId: string) => void
  /**
   * Live player readout (where they stand, whether they move/work). Polled by the
   * work bar on its own clock — pushing it through React state would re-render the
   * sidebar at frame rate.
   */
  player: () => PlayerReadout | null
  /** Bring the camera back to the player after a manual look-around. */
  focusPlayer: () => void
  /** Start/stop the hand-work animation on the player's body (the bar owns the timer). */
  setWorking: (pose: WorkPose | null) => void
}

export const SceneBridgeContext = createContext<SceneBridge>({
  highlight: () => {},
  panTo: () => {},
  player: () => null,
  focusPlayer: () => {},
  setWorking: () => {},
})

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

export function useSceneBridge(): SceneBridge {
  return useContext(SceneBridgeContext)
}

export function useThemeStore(): ThemeStore {
  const themeStore = useContext(ThemeContext)
  if (!themeStore) throw new Error('ThemeContext is missing')
  return themeStore
}

export function useThemeMode(): ThemeMode {
  const themeStore = useThemeStore()
  return useSyncExternalStore(themeStore.subscribe, themeStore.get)
}

export function useSoundStore(): SoundStore {
  const soundStore = useContext(SoundContext)
  if (!soundStore) throw new Error('SoundContext is missing')
  return soundStore
}

export function useSoundSettings(): SoundSettings {
  const soundStore = useSoundStore()
  return useSyncExternalStore(soundStore.subscribe, soundStore.get)
}

/**
 * Chases a Decimal with a short ease-out tween so numbers "run" instead of
 * jumping. Re-targets whenever the value changes (the store ticks at 10 Hz,
 * which reads as a continuous count-up).
 */
export function useAnimatedDecimal(target: Decimal, durationMs = 320): Decimal {
  const [displayed, setDisplayed] = useState<Decimal>(target)
  const displayedRef = useRef<Decimal>(target)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const from = displayedRef.current
    if (from.eq(target)) return
    const start = performance.now()
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = progress >= 1 ? target : from.add(target.sub(from).mul(eased))
      displayedRef.current = next
      setDisplayed(next)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [target, durationMs])

  return displayed
}
