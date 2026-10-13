import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BALANCE } from '@content/balance'
import { GAME_CONTENT } from '@content/index'
import { validateContent } from '@content/validate'
import type { OfflineReport } from '@domain/systems/offline'
import { createFreshState, stateFromSerialized } from '@domain/state'
import type { GameState } from '@domain/types'
import { LocaleStore, detectLocale } from '@i18n/locale'
import { isLocale, type Locale } from '@i18n/types'
import { LocalStorageAdapter } from '@platform/storage'
import { App } from '@ui/hud/App'
import { ContentContext, EngineContext, LocaleContext, ThemeContext } from '@ui/hooks'
import { ThemeStore, isThemeMode, type ThemeMode } from '@ui/theme'
import { ObservableStore } from '@core/store'
import { SaveManager } from '@core/save/saveManager'
import { Engine } from './engine'
import { startLoop } from './loop'

const SETTINGS_KEY = 'settings'
const DEFAULT_THEME: ThemeMode = 'light'

interface StoredSettings {
  locale?: string
  theme?: string
}

interface AppStores {
  localeStore: LocaleStore
  themeStore: ThemeStore
}

function loadStores(storage: LocalStorageAdapter): AppStores {
  let locale: Locale = detectLocale(navigator.language)
  let theme: ThemeMode = DEFAULT_THEME
  const raw = storage.get(SETTINGS_KEY)
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as StoredSettings
      if (typeof parsed.locale === 'string' && isLocale(parsed.locale)) {
        locale = parsed.locale
      }
      if (typeof parsed.theme === 'string' && isThemeMode(parsed.theme)) {
        theme = parsed.theme
      }
    } catch {
      // fall back to the defaults
    }
  }

  const localeStore = new LocaleStore(locale)
  const themeStore = new ThemeStore(theme)
  const persist = (): void => {
    document.documentElement.lang = localeStore.get()
    document.documentElement.dataset.theme = themeStore.get()
    storage.set(SETTINGS_KEY, JSON.stringify({ locale: localeStore.get(), theme: themeStore.get() }))
  }
  persist()
  localeStore.subscribe(persist)
  themeStore.subscribe(persist)
  return { localeStore, themeStore }
}

export function bootstrap(): void {
  const storage = new LocalStorageAdapter()
  const { localeStore, themeStore } = loadStores(storage)

  if (import.meta.env.DEV) {
    for (const error of validateContent(GAME_CONTENT)) {
      console.error(`[content] ${error}`)
    }
  }

  const saveManager = new SaveManager(storage, 'save')
  const file = saveManager.read()

  let state: GameState
  if (file) {
    const hydrated = stateFromSerialized(file.state, GAME_CONTENT, BALANCE.startMoney)
    state = hydrated.state
    for (const warning of hydrated.warnings) console.warn(`[save] ${warning}`)
  } else {
    state = createFreshState(GAME_CONTENT, BALANCE.startMoney)
  }

  const store = new ObservableStore(state)
  const engine = new Engine({
    content: GAME_CONTENT,
    store,
    saveManager,
    offlineCapSeconds: BALANCE.offlineCapHours * 3600,
    offlineModalThresholdSeconds: BALANCE.offlineModalThresholdSeconds,
  })

  let initialOfflineReport: OfflineReport | null = null
  if (file) {
    const elapsedSeconds = (Date.now() - file.savedAt) / 1000
    if (elapsedSeconds > BALANCE.gapThresholdSeconds) {
      const report = engine.applyElapsed(elapsedSeconds)
      initialOfflineReport = engine.shouldAnnounceOffline(report) ? report : null
    }
  }

  startLoop(engine, {
    tickSeconds: BALANCE.tickSeconds,
    autosaveSeconds: BALANCE.autosaveSeconds,
    gapThresholdSeconds: BALANCE.gapThresholdSeconds,
  })
  engine.saveNow()

  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('#root element not found')

  function Providers() {
    return (
      <EngineContext.Provider value={engine}>
        <ContentContext.Provider value={GAME_CONTENT}>
          <LocaleContext.Provider value={localeStore}>
            <ThemeContext.Provider value={themeStore}>
              <App initialOfflineReport={initialOfflineReport} />
            </ThemeContext.Provider>
          </LocaleContext.Provider>
        </ContentContext.Provider>
      </EngineContext.Provider>
    )
  }

  createRoot(rootElement).render(
    <StrictMode>
      <Providers />
    </StrictMode>,
  )
}
