import { formatShort } from '@core/format'
import { isWorkerUnlocked } from '@domain/conditions'
import {
  canAfford,
  workerCount,
  workerInputPerUnit,
  workerOutputPerUnit,
  workerQuote,
} from '@domain/selectors'
import { getResource } from '@domain/state'
import type { GameState, WorkerDef } from '@domain/types'
import { UI } from '@i18n/text'
import { useContent, useEngine, useLocale, useText } from '@ui/hooks'
import { describeCondition } from '@ui/progression'
import { playSound } from '@ui/sound/player'

export interface WorkerRowProps {
  branchId: string
  worker: WorkerDef
  state: GameState
}

export function WorkerRow({ branchId, worker, state }: WorkerRowProps) {
  const engine = useEngine()
  const content = useContent()
  const text = useText()
  const locale = useLocale()

  const owned = workerCount(state, branchId, worker.id)
  const single = workerQuote(state, content, branchId, worker.id, 1)
  const ten = workerQuote(state, content, branchId, worker.id, 10)
  const max = workerQuote(state, content, branchId, worker.id, 'max')
  const outputPerUnit = workerOutputPerUnit(state, content, branchId, worker.id)
  const inputPerUnit = workerInputPerUnit(state, content, branchId, worker.id)
  const outputItem = content.items[worker.output.item]
  const outputUnit = outputItem?.unit ?? outputItem?.name

  const money = getResource(state, content.currencyItemId)
  const costRatio = single.cost.lte(0) ? 1 : Math.min(1, money.div(single.cost).toNumber())

  const locked = !isWorkerUnlocked(state, content, branchId, worker.id)
  // A locked worker may be gated by its own condition or by its whole zone.
  const requirement = worker.requires ?? content.zones[worker.visual.zone]?.requires

  const outputName = outputUnit ? text(outputUnit) : ''
  // Transport/processing legs read "−vào → +ra"; pure producers keep "+ra".
  let rate = `+${formatShort(outputPerUnit)} ${outputName}/s`
  if (inputPerUnit) {
    const inputItem = content.items[worker.input?.item ?? '']
    const inputUnit = inputItem?.unit ?? inputItem?.name
    rate = `−${formatShort(inputPerUnit)} ${inputUnit ? text(inputUnit) : ''}/s → +${formatShort(outputPerUnit)} ${outputName}/s`
  }

  return (
    <li className={locked ? 'worker-row is-locked' : 'worker-row'}>
      <div className="worker-info">
        <span className="worker-name">{text(worker.name)}</span>
        {locked ? (
          <span className="lock-note">
            {requirement ? describeCondition(text, locale, content, requirement) : text(UI.locked)}
          </span>
        ) : (
          <>
            <span className="worker-meta">
              {rate} · {text(UI.owned)}: {owned} · {text(UI.nextCost)}: {formatShort(single.cost)}
            </span>
            <span className="cost-bar" role="img" aria-label={text(UI.costProgress)}>
              <span className="cost-bar-fill" style={{ width: `${Math.round(costRatio * 100)}%` }} />
            </span>
          </>
        )}
      </div>
      {!locked && (
        <div className="worker-actions">
          <button
            type="button"
            className="buy"
            disabled={!canAfford(state, content, single.cost)}
            onClick={(event) => {
              event.stopPropagation()
              const result = engine.buyWorker(branchId, worker.id, 1)
              playSound(result.ok ? 'buy' : 'deny')
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
              const result = engine.buyWorker(branchId, worker.id, 10)
              playSound(result.ok ? 'buy' : 'deny')
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
              const result = engine.buyWorker(branchId, worker.id, 'max')
              playSound(result.ok ? 'buy' : 'deny')
            }}
          >
            {text(UI.buyMax)}
          </button>
        </div>
      )}
    </li>
  )
}
