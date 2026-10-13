import type { GameState, WorkerDef } from '@domain/types'
import { UI } from '@i18n/text'
import { useContent, useSceneBridge, useText } from '@ui/hooks'
import { zoneStyle } from '@ui/scene/zoneLayout'
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

  return (
    <article
      className="zone-card"
      style={style}
      title={text(UI.zoneJump)}
      onMouseEnter={() => bridge.highlight(zoneId)}
      onMouseLeave={() => bridge.highlight(null)}
      onClick={() => bridge.panTo(zoneId)}
    >
      <header className="zone-header">
        <span className="zone-dot" />
        <h4 className="zone-name">{zone ? text(zone.name) : zoneId}</h4>
      </header>
      {zone && <p className="zone-desc">{text(zone.actionDesc)}</p>}
      <ul className="worker-list">
        {workers.map((worker) => (
          <WorkerRow key={worker.id} branchId={branchId} worker={worker} state={state} />
        ))}
      </ul>
    </article>
  )
}
