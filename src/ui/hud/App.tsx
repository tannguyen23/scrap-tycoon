import { useEffect, useRef, useState } from 'react'
import type { OfflineReport } from '@domain/systems/offline'
import { mountScene } from '@ui/scene/PixiScene'
import { useContent, useEngine, useGameState } from '@ui/hooks'
import { BranchPanel } from './BranchPanel'
import { OfflineModal } from './OfflineModal'
import { SettingsModal } from './SettingsModal'
import { TopBar } from './TopBar'

export interface AppProps {
  initialOfflineReport: OfflineReport | null
}

export function App({ initialOfflineReport }: AppProps) {
  const engine = useEngine()
  const content = useContent()
  const state = useGameState()
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(initialOfflineReport)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const sceneHostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    engine.setOfflineReportHandler(setOfflineReport)
    return () => engine.setOfflineReportHandler(null)
  }, [engine])

  useEffect(() => {
    const host = sceneHostRef.current
    if (!host) return
    let destroyed = false
    let dispose: (() => void) | null = null
    mountScene(host, engine.store)
      .then((handle) => {
        if (destroyed) handle.destroy()
        else dispose = () => handle.destroy()
      })
      .catch((error: unknown) => console.warn('[scene] failed to start', error))
    return () => {
      destroyed = true
      dispose?.()
    }
  }, [engine])

  return (
    <div className="game">
      <div className="scene-host" ref={sceneHostRef} aria-hidden="true" />
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="panels">
        {Object.values(content.branches).map((branch) => (
          <BranchPanel key={branch.id} branch={branch} state={state} />
        ))}
      </main>
      {offlineReport && <OfflineModal report={offlineReport} onClose={() => setOfflineReport(null)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
