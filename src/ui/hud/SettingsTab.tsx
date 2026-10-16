import { LANGUAGE_NAMES, UI } from '@i18n/text'
import { LOCALES } from '@i18n/types'
import { ZOOM_LEVELS } from '@scene/core/scene'
import {
  useEngine,
  useLocale,
  useLocaleStore,
  useSoundSettings,
  useSoundStore,
  useText,
  useThemeMode,
  useThemeStore,
} from '@ui/hooks'
import { playSound } from '@ui/sound/player'

export interface SettingsTabProps {
  /** Current zoom stop — an index into `ZOOM_LEVELS` (integer scale). */
  zoom: number
  onZoom: (index: number) => void
}

/**
 * Các dòng cài đặt (thu phóng · ngôn ngữ · giao diện · âm thanh · xoá save) — tab
 * "Cài đặt" của menu bánh răng. Trước đây là một modal riêng; giờ chỉ còn ruột,
 * khung do `MenuModal` lo.
 */
export function SettingsTab({ zoom, onZoom }: SettingsTabProps) {
  const engine = useEngine()
  const locale = useLocale()
  const localeStore = useLocaleStore()
  const theme = useThemeMode()
  const themeStore = useThemeStore()
  const soundStore = useSoundStore()
  const settings = useSoundSettings()
  const text = useText()

  const resetSave = (): void => {
    if (!window.confirm(text(UI.resetSaveConfirm))) return
    engine.resetSave()
    window.location.reload()
  }

  return (
    <div className="settings-tab">
      <div className="settings-row">
        <span>{text(UI.zoom)}</span>
        <div className="language-options">
          <input
            type="range"
            className="zoom-range"
            min={0}
            max={ZOOM_LEVELS.length - 1}
            step={1}
            value={zoom}
            aria-label={text(UI.zoom)}
            onChange={(event) => onZoom(Number(event.target.value))}
          />
          <span className="zoom-value">{ZOOM_LEVELS[zoom] ?? 1}×</span>
        </div>
      </div>

      <div className="settings-row">
        <span>{text(UI.language)}</span>
        <div className="language-options">
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              className={code === locale ? 'chip active' : 'chip'}
              onClick={() => {
                localeStore.set(code)
                playSound('click')
              }}
            >
              {LANGUAGE_NAMES[code]}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <span>{text(UI.theme)}</span>
        <div className="language-options">
          <button
            type="button"
            className={theme === 'light' ? 'chip active' : 'chip'}
            onClick={() => {
              themeStore.set('light')
              playSound('click')
            }}
          >
            {text(UI.themeLight)}
          </button>
          <button
            type="button"
            className={theme === 'dark' ? 'chip active' : 'chip'}
            onClick={() => {
              themeStore.set('dark')
              playSound('click')
            }}
          >
            {text(UI.themeDark)}
          </button>
        </div>
      </div>

      <div className="settings-row">
        <span>{text(UI.sound)}</span>
        <div className="language-options">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(settings.volume * 100)}
            aria-label={text(UI.sound)}
            onChange={(event) => soundStore.set({ volume: Number(event.target.value) / 100 })}
          />
          <button
            type="button"
            className={settings.muted ? 'chip active' : 'chip'}
            onClick={() => {
              soundStore.set({ muted: !settings.muted })
              playSound('click')
            }}
          >
            {text(settings.muted ? UI.soundUnmute : UI.soundMute)}
          </button>
        </div>
      </div>

      <div className="settings-row">
        <button type="button" className="danger" onClick={resetSave}>
          {text(UI.resetSave)}
        </button>
      </div>
    </div>
  )
}
