import type { MilestoneDef } from '@domain/types'
import { UI } from '@i18n/text'
import { useText } from '@ui/hooks'

export interface MilestoneToastProps {
  milestone: MilestoneDef
}

/** Transient banner when a milestone is reached — dismiss timing is owned by App. */
export function MilestoneToast({ milestone }: MilestoneToastProps) {
  const text = useText()
  return (
    <div className="toast" role="status">
      <span className="toast-title">{text(UI.milestoneReached, { name: text(milestone.name) })}</span>
      <span className="toast-desc">{text(milestone.desc)}</span>
    </div>
  )
}
