import { LANGUAGE_NAMES, UI } from '@i18n/text'
import { LOCALES } from '@i18n/types'
import { useEngine, useLocale, useLocaleStore, useText } from '@ui/hooks'

export interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const engine = useEngine()
  const locale = useLocale()
  const localeStore = useLocaleStore()
  const text = useText()

  const resetSave = (): void => {
    if (!window.confirm(text(UI.resetSaveConfirm))) return
    engine.resetSave()
    window.location.reload()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>{text(UI.settings)}</h2>

        <div className="settings-row">
          <span>{text(UI.language)}</span>
          <div className="language-options">
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                className={code === locale ? 'chip active' : 'chip'}
                onClick={() => localeStore.set(code)}
              >
                {LANGUAGE_NAMES[code]}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-row">
          <button type="button" className="danger" onClick={resetSave}>
            {text(UI.resetSave)}
          </button>
        </div>

        <button type="button" onClick={onClose}>
          {text(UI.close)}
        </button>
      </div>
    </div>
  )
}
