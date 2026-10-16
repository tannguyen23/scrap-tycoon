import type { OfflineReport } from '@domain/systems/offline'
import type { MilestoneDef } from '@domain/types'
import type { Rect } from '@ground/core/metrics'
import { UI } from '@i18n/text'
import { SceneBridgeContext, useContent, useEngine, useGameState, useLocaleStore, useText, type SceneBridge } from '@ui/hooks'
import { ZOOM_LEVELS } from '@scene/core/scene'
import { mountGameScene, type GameScene } from '@ui/scene/PixiScene'
import { playSound } from '@ui/sound/player'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionBar } from './ActionBar'
import { BranchPanel } from './BranchPanel'
import { MilestonePanel } from './MilestonePanel'
import { MilestoneToast } from './MilestoneToast'
import { Minimap } from './Minimap'
import { OfflineModal } from './OfflineModal'
import { SettingsModal } from './SettingsModal'
import { TopBar } from './TopBar'

export interface AppProps {
  initialOfflineReport: OfflineReport | null
}

interface MilestoneToastEntry {
  key: number
  milestone: MilestoneDef
}

const TOAST_LIFETIME_MS = 5200

export function App({ initialOfflineReport }: AppProps) {
  const engine = useEngine()
  const content = useContent()
  const state = useGameState()
  const localeStore = useLocaleStore()
  const text = useText()
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(initialOfflineReport)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(0)
  const [sceneHandle, setSceneHandle] = useState<GameScene | null>(null)
  const [toasts, setToasts] = useState<MilestoneToastEntry[]>([])
  const [minimapOpen, setMinimapOpen] = useState(false)
  const viewRef = useRef<Rect | null>(null)
  const toastKeyRef = useRef(0)
  const sceneHostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    engine.setOfflineReportHandler(setOfflineReport)
    return () => engine.setOfflineReportHandler(null)
  }, [engine])

  useEffect(() => {
    engine.setMilestoneHandler((milestone) => {
      playSound('milestone')
      const key = toastKeyRef.current
      toastKeyRef.current += 1
      setToasts((current) => [...current, { key, milestone }])
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.key !== key))
      }, TOAST_LIFETIME_MS)
    })
    return () => engine.setMilestoneHandler(null)
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
    let handle: GameScene | null = null

    mountGameScene(host, engine.store, content, {
      onZoomLevelChange: setZoomLevel,
      localeStore,
      // Straight into a ref: the minimap reads it on its own clock, so panning
      // never re-renders the HUD (a state write here meant a full sidebar render
      // every few world pixels of drag).
      onViewChange: (next) => {
        viewRef.current = next
      },
    })
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

  // M toggles the minimap, like every map screen ever.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'm' || event.key === 'M') setMinimapOpen((open) => !open)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const bridge = useMemo<SceneBridge>(
    () => ({
      highlight: (zoneId) => sceneHandle?.setHighlight(zoneId),
      panTo: (zoneId) => sceneHandle?.panTo(zoneId),
      player: () => sceneHandle?.player() ?? null,
      focusPlayer: () => sceneHandle?.focusPlayer(),
      setWorking: (pose) => sceneHandle?.setWorking(pose),
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
            <button
              type="button"
              className={minimapOpen ? 'chip active' : 'chip'}
              title={text(UI.minimapHint)}
              onClick={() => setMinimapOpen((open) => !open)}
            >
              {text(UI.minimap)}
            </button>
            <button
              type="button"
              className="chip"
              title={text(UI.backToPlayerHint)}
              onClick={() => {
                bridge.focusPlayer()
                playSound('click')
              }}
            >
              {text(UI.backToPlayer)}
            </button>
          </div>
          {minimapOpen && (
            <Minimap viewRef={viewRef} onJump={(x, y) => sceneHandle?.focusOn(x, y)} />
          )}
          <ActionBar />
        </div>
        <aside className="sidebar">
          <TopBar onOpenSettings={() => setSettingsOpen(true)} />
          <main className="panels">
            <MilestonePanel />
            {Object.values(content.branches).map((branch) => (
              <BranchPanel key={branch.id} branch={branch} state={state} />
            ))}
          </main>
        </aside>
        {toasts.length > 0 && (
          <div className="toast-stack">
            {toasts.map((toast) => (
              <MilestoneToast key={toast.key} milestone={toast.milestone} />
            ))}
          </div>
        )}
        {offlineReport && (
          <OfflineModal report={offlineReport} onClose={() => setOfflineReport(null)} />
        )}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </div>
    </SceneBridgeContext.Provider>
  )
}
