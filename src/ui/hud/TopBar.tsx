import { formatShort } from '@core/format'
import { currentWeather, incomePerSecond } from '@domain/selectors'
import { getResource } from '@domain/state'
import { UI } from '@i18n/text'
import { useAnimatedDecimal, useContent, useGameState, useText } from '@ui/hooks'

/**
 * Hoá đơn tiền + thu nhập + thời tiết, dán nổi góc trên-trái màn chơi. Không còn
 * nút nào ở đây — mọi thứ cài đặt/giao diện/ngôn ngữ đã chui vào menu bánh răng,
 * để sân chơi giữ trọn màn hình.
 */
export function TopBar() {
  const content = useContent()
  const state = useGameState()
  const text = useText()

  const currency = content.items[content.currencyItemId]
  const money = getResource(state, content.currencyItemId)
  const shownMoney = useAnimatedDecimal(money)
  const income = incomePerSecond(state, content)
  const weather = currentWeather(content, state)

  return (
    <header className="topbar">
      <div className="money">
        {currency && <span className="currency-name">{text(currency.name)}</span>}
        <strong className="money-value">{formatShort(shownMoney)}</strong>
      </div>
      <div className="income">
        {text(UI.incomePerSecond)}: {formatShort(income)}
      </div>
      {weather && (
        <div className="weather-chip" title={text(UI.weather)}>
          <span className="weather-name">{text(weather.label)}</span>
          {weather.workMultiplier !== 1 && (
            <span className="weather-effect">×{weather.workMultiplier}</span>
          )}
        </div>
      )}
    </header>
  )
}
