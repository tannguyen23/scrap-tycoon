import { formatShort } from '@core/format'
import { isUpgradeUnlocked } from '@domain/conditions'
import { canAfford, isUpgradePurchased } from '@domain/selectors'
import type { GameState, UpgradeDef } from '@domain/types'
import { UI } from '@i18n/text'
import { useContent, useEngine, useLocale, useText } from '@ui/hooks'
import { describeCondition } from '@ui/progression'
import { playSound } from '@ui/sound/player'

export interface UpgradeCardProps {
  branchId: string
  upgrade: UpgradeDef
  state: GameState
}

export function UpgradeCard({ branchId, upgrade, state }: UpgradeCardProps) {
  const engine = useEngine()
  const content = useContent()
  const text = useText()
  const locale = useLocale()

  const purchased = isUpgradePurchased(state, branchId, upgrade.id)
  const affordable = canAfford(state, content, upgrade.cost)
  const locked = !isUpgradeUnlocked(state, content, branchId, upgrade.id)

  const className = `upgrade-card${purchased ? ' purchased' : ''}${locked && !purchased ? ' is-locked' : ''}`

  return (
    <div className={className}>
      <span className="upgrade-name">{text(upgrade.name)}</span>
      <span className="upgrade-desc">{text(upgrade.desc)}</span>
      {purchased ? (
        <span className="stamp">{text(UI.purchased)}</span>
      ) : locked ? (
        <span className="lock-note">
          {upgrade.requires
            ? describeCondition(text, locale, content, upgrade.requires)
            : text(UI.locked)}
        </span>
      ) : (
        <button
          type="button"
          className="buy"
          disabled={!affordable}
          onClick={(event) => {
            event.stopPropagation()
            const result = engine.buyUpgrade(branchId, upgrade.id)
            playSound(result.ok ? 'upgrade' : 'deny')
          }}
        >
          {text(UI.buy)} · {formatShort(upgrade.cost)}
        </button>
      )}
    </div>
  )
}
