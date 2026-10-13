import { formatShort } from '@core/format'
import { canAfford, workerCount, workerOutputPerUnit, workerQuote } from '@domain/selectors'
import { getResource } from '@domain/state'
import type { GameState, WorkerDef } from '@domain/types'
import { UI } from '@i18n/text'
import { useContent, useEngine, useText } from '@ui/hooks'

export interface WorkerRowProps {
  branchId: string
  worker: WorkerDef
  state: GameState
}

export function WorkerRow({ branchId, worker, state }: WorkerRowProps) {
  const engine = useEngine()
  const content = useContent()
  const text = useText()

  const owned = workerCount(state, branchId, worker.id)
  const single = workerQuote(state, content, branchId, worker.id, 1)
  const ten = workerQuote(state, content, branchId, worker.id, 10)
  const max = workerQuote(state, content, branchId, worker.id, 'max')
  const outputPerUnit = workerOutputPerUnit(state, content, branchId, worker.id)
  const outputItem = content.items[worker.output.item]
  const outputUnit = outputItem?.unit ?? outputItem?.name

  const money = getResource(state, content.currencyItemId)
  const costRatio = single.cost.lte(0) ? 1 : Math.min(1, money.div(single.cost).toNumber())

  return (
    <li className="worker-row">
      <div className="worker-info">
        <span className="worker-name">{text(worker.name)}</span>
        <span className="worker-meta">
          +{formatShort(outputPerUnit)} {outputUnit ? text(outputUnit) : ''}/s · {text(UI.owned)}: {owned} ·{' '}
          {text(UI.nextCost)}: {formatShort(single.cost)}
        </span>
        <span className="cost-bar" role="img" aria-label={text(UI.costProgress)}>
          <span className="cost-bar-fill" style={{ width: `${Math.round(costRatio * 100)}%` }} />
        </span>
      </div>
      <div className="worker-actions">
        <button
          type="button"
          className="buy"
          disabled={!canAfford(state, content, single.cost)}
          onClick={(event) => {
            event.stopPropagation()
            engine.buyWorker(branchId, worker.id, 1)
          }}
        >
          ×1
        </button>
        <button
          type="button"
          className="buy"
          disabled={!canAfford(state, content, ten.cost)}
          onClick={(event) => {
            event.stopPropagation()
            engine.buyWorker(branchId, worker.id, 10)
          }}
        >
          ×10
        </button>
        <button
          type="button"
          className="buy"
          disabled={max.count <= 0}
          onClick={(event) => {
            event.stopPropagation()
            engine.buyWorker(branchId, worker.id, 'max')
          }}
        >
          {text(UI.buyMax)}
        </button>
      </div>
    </li>
  )
}
