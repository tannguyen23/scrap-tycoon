import { formatShort } from '@core/format'
import { canAfford, workerCount, workerOutputPerUnit, workerQuote } from '@domain/selectors'
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

  return (
    <li className="worker-row">
      <div className="worker-info">
        <span className="worker-name">{text(worker.name)}</span>
        <span className="worker-meta">
          +{formatShort(outputPerUnit)} {outputUnit ? text(outputUnit) : ''}/s · {text(UI.owned)}: {owned} ·{' '}
          {text(UI.nextCost)}: {formatShort(single.cost)}
        </span>
      </div>
      <div className="worker-actions">
        <button
          type="button"
          disabled={!canAfford(state, content, single.cost)}
          onClick={() => engine.buyWorker(branchId, worker.id, 1)}
        >
          ×1
        </button>
        <button
          type="button"
          disabled={!canAfford(state, content, ten.cost)}
          onClick={() => engine.buyWorker(branchId, worker.id, 10)}
        >
          ×10
        </button>
        <button
          type="button"
          disabled={max.count <= 0}
          onClick={() => engine.buyWorker(branchId, worker.id, 'max')}
        >
          {text(UI.buyMax)}
        </button>
      </div>
    </li>
  )
}
