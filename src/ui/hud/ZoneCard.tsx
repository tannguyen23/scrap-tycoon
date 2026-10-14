import { formatShort } from '@core/format'
import { stockInfo, stockRatio, zoneStockItem } from '@domain/selectors'
import type { GameState, WorkerDef } from '@domain/types'
import { UI } from '@i18n/text'
import { useContent, useSceneBridge, useText } from '@ui/hooks'
import { zoneStyle } from '@ui/scene/zoneLayout'
import { playSound } from '@ui/sound/player'
import type { CSSProperties } from 'react'
import { WorkerRow } from './WorkerRow'

export interface ZoneCardProps {
  zoneId: string
  branchId: string
  workers: readonly WorkerDef[]
  state: GameState
}

/** One HUD card per map zone: hover to highlight it on the map, click to pan there. */
export function ZoneCard({ zoneId, branchId, workers, state }: ZoneCardProps) {
  const content = useContent()
  const text = useText()
  const bridge = useSceneBridge()

  const zone = content.zones[zoneId]
  const style = { '--zone-color': zoneStyle(zoneId).css } as CSSProperties

  const stockItemId = zoneStockItem(content, zoneId)
  const stockItem = stockItemId ? content.items[stockItemId] : undefined
  const stock = stockItemId ? stockInfo(state, content, stockItemId) : null
  const ratio = stockItemId ? stockRatio(state, content, stockItemId) : null
  const isFull = ratio !== null && ratio >= 0.99

  return (
    <article
      className="zone-card"
      style={style}
      title={text(UI.zoneJump)}
      onMouseEnter={() => bridge.highlight(zoneId)}
      onMouseLeave={() => bridge.highlight(null)}
      onClick={() => {
        bridge.panTo(zoneId)
        playSound('click')
      }}
    >
      <header className="zone-header">
        <span className="zone-dot" />
        <h4 className="zone-name">{zone ? text(zone.name) : zoneId}</h4>
        {isFull && <span className="zone-full">{text(UI.full)}</span>}
      </header>
      {zone && <p className="zone-desc">{text(zone.actionDesc)}</p>}
      {stockItemId && stockItem && stock && (
        <p className={`zone-stock${isFull ? ' is-full' : ''}`}>
          {text(UI.stock)} {text(stockItem.name)}: {formatShort(stock.amount)}/{formatShort(stock.cap)}
        </p>
      )}
      <ul className="worker-list">
        {workers.map((worker) => (
          <WorkerRow key={worker.id} branchId={branchId} worker={worker} state={state} />
        ))}
      </ul>
    </article>
  )
}
