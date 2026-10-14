import { useState } from 'react'
import { STUDIO_PROJECTS } from './projects'
import { PacksTab, ScatterTab, SeamsTab, TilesTab } from './tabs'
import type { StudioTab } from './types'

/** Tabs that come from the kits and work for any project. */
const KIT_TABS: readonly StudioTab[] = [
  { id: 'packs', label: 'Pack nền', render: () => <PacksTab /> },
  { id: 'tiles', label: 'Tileset', render: () => <TilesTab /> },
  { id: 'scatter', label: 'Scatter', render: () => <ScatterTab /> },
  { id: 'seams', label: 'Chỗ nối tileset', render: () => <SeamsTab /> },
]

/**
 * Asset studio shell: kit tabs plus the selected project's own tabs. The shell
 * imports kits and project adapters only — never a project's own modules — so it
 * can be lifted out of the game repo as-is.
 */
export function Studio() {
  const [projectId, setProjectId] = useState(STUDIO_PROJECTS[0]?.id ?? '')
  const [tab, setTab] = useState('tiles')
  const project = STUDIO_PROJECTS.find((entry) => entry.id === projectId) ?? STUDIO_PROJECTS[0]
  const tabs = [...KIT_TABS, ...(project?.tabs ?? [])]
  const active = tabs.find((entry) => entry.id === tab) ?? tabs[0]

  return (
    <div className="studio">
      <header className="studio-head">
        <span className="studio-title">Asset Studio</span>
        <nav className="studio-tabs">
          {STUDIO_PROJECTS.map((entry) => (
            <button
              key={entry.id}
              className={`chip${entry.id === project?.id ? ' active' : ''}`}
              onClick={() => setProjectId(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <nav className="studio-tabs">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              className={`chip${entry.id === active?.id ? ' active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <span className="studio-note">dev-only · localhost:5180</span>
      </header>
      <main className="studio-body">{active?.render()}</main>
    </div>
  )
}
