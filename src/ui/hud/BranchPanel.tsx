import type { BranchDef, GameState } from '@domain/types'
import { UI } from '@i18n/text'
import { useText } from '@ui/hooks'
import { UpgradeCard } from './UpgradeCard'
import { WorkerRow } from './WorkerRow'

export interface BranchPanelProps {
  branch: BranchDef
  state: GameState
}

export function BranchPanel({ branch, state }: BranchPanelProps) {
  const text = useText()

  return (
    <section className="panel">
      <h2>{text(branch.name)}</h2>

      <h3>{text(UI.workers)}</h3>
      <ul className="worker-list">
        {branch.workers.map((worker) => (
          <WorkerRow key={worker.id} branchId={branch.id} worker={worker} state={state} />
        ))}
      </ul>

      <h3>{text(UI.upgrades)}</h3>
      <div className="upgrade-grid">
        {branch.upgrades.map((upgrade) => (
          <UpgradeCard key={upgrade.id} branchId={branch.id} upgrade={upgrade} state={state} />
        ))}
      </div>
    </section>
  )
}
