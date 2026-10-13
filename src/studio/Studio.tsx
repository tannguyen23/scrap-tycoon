import { useState } from 'react'
import {
  CharactersTab,
  DecorTab,
  LayoutTab,
  LightingTab,
  PropsTab,
  ScatterTab,
  SeamsTab,
  TilesTab,
  ZonesTab,
} from './tabs'

const TABS = [
  { id: 'tiles', label: 'Tileset', render: () => <TilesTab /> },
  { id: 'scatter', label: 'Scatter', render: () => <ScatterTab /> },
  { id: 'decor', label: 'Decor', render: () => <DecorTab /> },
  { id: 'characters', label: 'Nhân vật', render: () => <CharactersTab /> },
  { id: 'props', label: 'Props & xe', render: () => <PropsTab /> },
  { id: 'zones', label: 'Khu', render: () => <ZonesTab /> },
  { id: 'seams', label: 'Chỗ nối tileset', render: () => <SeamsTab /> },
  { id: 'layout', label: 'Sơ đồ & nối khu', render: () => <LayoutTab /> },
  { id: 'lighting', label: 'Ánh sáng', render: () => <LightingTab /> },
] as const

type TabId = (typeof TABS)[number]['id']

/** Asset studio shell: one tab per art discipline, all reading the game's own modules. */
export function Studio() {
  const [tab, setTab] = useState<TabId>('tiles')
  const active = TABS.find((entry) => entry.id === tab) ?? TABS[0]

  return (
    <div className="studio">
      <header className="studio-head">
        <span className="studio-title">Asset Studio</span>
        <nav className="studio-tabs">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              className={`chip${entry.id === tab ? ' active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <span className="studio-note">dev-only · localhost:5180</span>
      </header>
      <main className="studio-body">{active.render()}</main>
    </div>
  )
}