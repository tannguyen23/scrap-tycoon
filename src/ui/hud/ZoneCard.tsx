import { formatShort } from '@core/format'
import { zoneStock } from '@domain/selectors'
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

  const rows = zoneStock(state, content, zoneId)
  const isFull = rows.some((row) => row.ratio !== null && row.ratio >= 0.99)

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
      {rows.map((row) => {
        const item = content.items[row.itemId]
        if (!item) return null
        const full = row.ratio !== null && row.ratio >= 0.99
        return (
          <p key={row.itemId} className={`zone-stock${full ? ' is-full' : ''}`}>
            {text(UI.stock)} {text(item.name)}: {formatShort(row.amount)}
            {row.cap ? `/${formatShort(row.cap)}` : ''}
          </p>
        )
      })}
      <ul className="worker-list">
        {workers.map((worker) => (
          <WorkerRow key={worker.id} branchId={branchId} worker={worker} state={state} />
        ))}
      </ul>
    </article>
  )
}
