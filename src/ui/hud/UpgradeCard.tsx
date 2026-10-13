import { formatShort } from '@core/format'
import { canAfford, isUpgradePurchased } from '@domain/selectors'
import type { GameState, UpgradeDef } from '@domain/types'
import { UI } from '@i18n/text'
import { useContent, useEngine, useText } from '@ui/hooks'

export interface UpgradeCardProps {
  branchId: string
  upgrade: UpgradeDef
  state: GameState
}

export function UpgradeCard({ branchId, upgrade, state }: UpgradeCardProps) {
  const engine = useEngine()
  const content = useContent()
  const text = useText()

  const purchased = isUpgradePurchased(state, branchId, upgrade.id)
  const affordable = canAfford(state, content, upgrade.cost)

  return (
    <div className={purchased ? 'upgrade-card purchased' : 'upgrade-card'}>
      <span className="upgrade-name">{text(upgrade.name)}</span>
      <span className="upgrade-desc">{text(upgrade.desc)}</span>
      {purchased ? (
        <span className="stamp">{text(UI.purchased)}</span>
      ) : (
        <button
          type="button"
          className="buy"
          disabled={!affordable}
          onClick={(event) => {
            event.stopPropagation()
            engine.buyUpgrade(branchId, upgrade.id)
          }}
        >
          {text(UI.buy)} · {formatShort(upgrade.cost)}
        </button>
      )}
    </div>
  )
}
