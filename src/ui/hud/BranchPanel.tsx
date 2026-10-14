import { formatShort } from '@core/format'
import { recipeOutputPerSecond } from '@domain/selectors'
import type { BranchDef, GameState, WorkerDef } from '@domain/types'
import { UI } from '@i18n/text'
import { useContent, useText } from '@ui/hooks'
import { UpgradeCard } from './UpgradeCard'
import { ZoneCard } from './ZoneCard'

export interface BranchPanelProps {
  branch: BranchDef
  state: GameState
}

export function BranchPanel({ branch, state }: BranchPanelProps) {
  const text = useText()
  const content = useContent()

  const workersByZone = new Map<string, WorkerDef[]>()
  for (const worker of branch.workers) {
    const list = workersByZone.get(worker.visual.zone)
    if (list) list.push(worker)
    else workersByZone.set(worker.visual.zone, [worker])
  }

  return (
    <section className="panel">
      <h2>{text(branch.name)}</h2>

      <div className="zone-grid">
        {[...workersByZone.entries()].map(([zoneId, workers]) => (
          <ZoneCard
            key={zoneId}
            zoneId={zoneId}
            branchId={branch.id}
            workers={workers}
            state={state}
          />
        ))}
      </div>

      {branch.recipes.length > 0 && (
        <>
          <h3>{text(UI.saleChannels)}</h3>
          {/* Recipe không có nút: đây là các kênh bán phần dư chạy tự động, hiện
              giá + trần tiền mỗi giây để người chơi hiểu tiền đến từ đâu. */}
          <ul className="sale-list">
            {branch.recipes.map((recipe) => {
              const inputItem = content.items[recipe.input.item]
              const unit = inputItem?.unit ?? inputItem?.name
              const rate = recipe.input.rate
              const perSecond = recipeOutputPerSecond(state, content, branch.id, recipe.id)
              const detail = rate
                ? `${formatShort(rate)} ${unit ? text(unit) : ''}/s × ${formatShort(recipe.output.perInputUnit)}`
                : ''
              return (
                <li key={recipe.id} className="sale-row" title={detail}>
                  <span className="sale-name">{text(recipe.name)}</span>
                  <span className="sale-value">≤ {formatShort(perSecond)}/s</span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <h3>{text(UI.upgrades)}</h3>
      <div className="upgrade-grid">
        {branch.upgrades.map((upgrade) => (
          <UpgradeCard key={upgrade.id} branchId={branch.id} upgrade={upgrade} state={state} />
        ))}
      </div>
    </section>
  )
}
