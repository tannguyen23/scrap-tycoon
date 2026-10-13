import { formatShort } from '@core/format'
import { incomePerSecond } from '@domain/selectors'
import { getResource } from '@domain/state'
import { LANGUAGE_NAMES, UI } from '@i18n/text'
import { useContent, useGameState, useLocale, useLocaleStore, useText } from '@ui/hooks'

export interface TopBarProps {
  onOpenSettings: () => void
}

export function TopBar({ onOpenSettings }: TopBarProps) {
  const content = useContent()
  const state = useGameState()
  const locale = useLocale()
  const localeStore = useLocaleStore()
  const text = useText()

  const currency = content.items[content.currencyItemId]
  const money = getResource(state, content.currencyItemId)
  const income = incomePerSecond(state, content)
  const nextLocale = locale === 'vi' ? 'en' : 'vi'

  return (
    <header className="topbar">
      <div className="money">
        {currency && <span className="currency-name">{text(currency.name)}</span>}
        <strong className="money-value">{formatShort(money)}</strong>
      </div>
      <div className="income">
        {text(UI.incomePerSecond)}: {formatShort(income)}
      </div>
      <div className="topbar-actions">
        <button type="button" className="chip" title={LANGUAGE_NAMES[nextLocale]} onClick={() => localeStore.set(nextLocale)}>
          {nextLocale.toUpperCase()}
        </button>
        <button type="button" onClick={onOpenSettings}>
          {text(UI.settings)}
        </button>
      </div>
    </header>
  )
}
