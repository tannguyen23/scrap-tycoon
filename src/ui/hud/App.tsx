import type { OfflineReport } from '@domain/systems/offline'
import { UI } from '@i18n/text'
import { SceneBridgeContext, useContent, useEngine, useGameState, useLocaleStore, useText, type SceneBridge } from '@ui/hooks'
import { ZOOM_LEVELS } from '@scene/core/scene'
import { mountGameScene, type SceneHandle } from '@ui/scene/PixiScene'
import { playSound } from '@ui/sound/player'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const localeStore = useLocaleStore()
  const text = useText()
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(initialOfflineReport)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(0)
  const [sceneHandle, setSceneHandle] = useState<SceneHandle | null>(null)
  const sceneHostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    engine.setOfflineReportHandler(setOfflineReport)
    return () => engine.setOfflineReportHandler(null)
  }, [engine])

  // One chime per report; the ref keeps StrictMode's double effect from doubling it.
  const offlineChimedRef = useRef(false)
  useEffect(() => {
    if (!offlineReport) {
      offlineChimedRef.current = false
      return
    }
    if (offlineChimedRef.current) return
    offlineChimedRef.current = true
    playSound('offline')
  }, [offlineReport])

  useEffect(() => {
    const host = sceneHostRef.current
    if (!host) return
    let cancelled = false
    let handle: SceneHandle | null = null

    mountGameScene(host, engine.store, content, { onZoomLevelChange: setZoomLevel, localeStore })
      .then((mounted) => {
        handle = mounted
        if (cancelled) mounted.destroy()
        else setSceneHandle(mounted)
      })
      .catch((error: unknown) => console.warn('[scene] failed to start', error))

    return () => {
      cancelled = true
      setSceneHandle(null)
      handle?.destroy()
    }
  }, [engine, content, localeStore])

  const bridge = useMemo<SceneBridge>(
    () => ({
      highlight: (zoneId) => sceneHandle?.setHighlight(zoneId),
      panTo: (zoneId) => sceneHandle?.panTo(zoneId),
    }),
    [sceneHandle],
  )

  const changeZoom = (level: number): void => {
    setZoomLevel(level)
    sceneHandle?.setZoomLevel(level)
    playSound('click')
  }

  const zoomTitles = [text(UI.zoomFar), text(UI.zoomMid), text(UI.zoomNear)]

  return (
    <SceneBridgeContext.Provider value={bridge}>
      <div className="game">
        <div className="scene-host">
          <div className="scene-frame" ref={sceneHostRef} aria-hidden="true">
            <span className="tape tape-a" />
            <span className="tape tape-b" />
            <span className="pin" />
          </div>
          <div className="scene-controls">
            {ZOOM_LEVELS.map((scale, index) => (
              <button
                key={scale}
                type="button"
                className={index === zoomLevel ? 'chip active' : 'chip'}
                title={zoomTitles[index]}
                onClick={() => changeZoom(index)}
              >
                {scale}×
              </button>
            ))}
          </div>
        </div>
        <aside className="sidebar">
          <TopBar onOpenSettings={() => setSettingsOpen(true)} />
          <main className="panels">
            {Object.values(content.branches).map((branch) => (
              <BranchPanel key={branch.id} branch={branch} state={state} />
            ))}
          </main>
        </aside>
        {offlineReport && (
          <OfflineModal report={offlineReport} onClose={() => setOfflineReport(null)} />
        )}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </div>
    </SceneBridgeContext.Provider>
  )
}
