import { formatShort } from '@core/format'
import { milestoneStatus } from '@domain/milestones'
import { UI } from '@i18n/text'
import { useContent, useGameState, useText } from '@ui/hooks'
import { describeEffect } from '@ui/progression'

/** Sidebar section listing every progression milestone with progress and reward. */
export function MilestonePanel() {
  const content = useContent()
  const state = useGameState()
  const text = useText()

  const rows = milestoneStatus(state, content)
  if (rows.length === 0) return null

  return (
    <section className="panel">
      <h2>{text(UI.milestones)}</h2>
      <div className="milestone-list">
        {rows.map(({ milestone, done, progress }) => {
          const ratio = progress.target.lte(0)
            ? 1
            : Math.min(1, progress.current.div(progress.target).toNumber())
          const reward = milestone.reward?.map((effect) => describeEffect(text, content, effect)).join(' · ')
          return (
            <div key={milestone.id} className={done ? 'milestone-card done' : 'milestone-card'}>
              <div className="milestone-head">
                <span className="milestone-name">{text(milestone.name)}</span>
                {done && <span className="stamp">{text(UI.achieved)}</span>}
              </div>
              <span className="milestone-desc">{text(milestone.desc)}</span>
              <span className="cost-bar" role="img" aria-label={text(UI.costProgress)}>
                <span className="cost-bar-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
              </span>
              <span className="milestone-meta">
                {done ? '' : `${formatShort(progress.current)}/${formatShort(progress.target)}`}
                {reward ? text(UI.rewardLabel, { reward }) : ''}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
