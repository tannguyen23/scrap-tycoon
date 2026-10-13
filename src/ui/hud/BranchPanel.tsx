import type { BranchDef, GameState, WorkerDef } from '@domain/types'
import { UI } from '@i18n/text'
import { useText } from '@ui/hooks'
import { UpgradeCard } from './UpgradeCard'
import { ZoneCard } from './ZoneCard'

export interface BranchPanelProps {
  branch: BranchDef
  state: GameState
}

export function BranchPanel({ branch, state }: BranchPanelProps) {
  const text = useText()

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

      <h3>{text(UI.upgrades)}</h3>
      <div className="upgrade-grid">
        {branch.upgrades.map((upgrade) => (
          <UpgradeCard key={upgrade.id} branchId={branch.id} upgrade={upgrade} state={state} />
        ))}
      </div>
    </section>
  )
}
