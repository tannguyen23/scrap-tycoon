import type { OfflineReport } from '@domain/systems/offline'
import type { ItemId, MilestoneDef } from '@domain/types'
import type { Rect } from '@ground/core/metrics'
import { UI } from '@i18n/text'
import { SceneBridgeContext, useContent, useEngine, useLocaleStore, useText, type SceneBridge } from '@ui/hooks'
import { mountGameScene, type GameScene } from '@ui/scene/PixiScene'
import { isTypingTarget } from '@ui/scene/player/keys'
import { playSound } from '@ui/sound/player'
import type Decimal from 'break_eternity.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActionBar } from './ActionBar'
import { InventoryPanel, type SheetTab } from './InventoryPanel'
import { LootToast } from './LootToast'
import { MenuModal, type MenuTab } from './MenuModal'
import { MilestoneToast } from './MilestoneToast'
import { Minimap } from './Minimap'
import { OfflineModal } from './OfflineModal'
import { TopBar } from './TopBar'

export interface AppProps {
  initialOfflineReport: OfflineReport | null
}

interface MilestoneToastEntry {
  key: number
  milestone: MilestoneDef
}

interface LootEntry {
  key: number
  item: ItemId
  amount: Decimal
}

const TOAST_LIFETIME_MS = 5200
/** Nhật ký nhặt đồ: bay nhanh hơn toast mốc, và chỉ giữ vài dòng gần nhất. */
const LOOT_LIFETIME_MS = 2400
const LOOT_STACK_MAX = 4

export function App({ initialOfflineReport }: AppProps) {
  const engine = useEngine()
  const content = useContent()
  const localeStore = useLocaleStore()
  const text = useText()
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(initialOfflineReport)
  const [menuOpen, setMenuOpen] = useState(false)
  // The gear menu keeps the tab you left it on: upgrades and settings are two
  // halves of one screen, exactly like the bag's tabs.
  const [menuTab, setMenuTab] = useState<MenuTab>('progress')
  const [zoomLevel, setZoomLevel] = useState(0)
  const [sceneHandle, setSceneHandle] = useState<GameScene | null>(null)
  const [toasts, setToasts] = useState<MilestoneToastEntry[]>([])
  const [loot, setLoot] = useState<LootEntry[]>([])
  // The E sheet keeps the tab you left it on — bag and character are two halves of
  // one screen, not two screens.
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTab, setSheetTab] = useState<SheetTab>('items')
  const viewRef = useRef<Rect | null>(null)
  const toastKeyRef = useRef(0)
  const lootKeyRef = useRef(0)
  const sceneHostRef = useRef<HTMLDivElement | null>(null)
  // Sheet and menu both own the screen: the work bar pauses and the walker freezes
  // while either is up.
  const overlayOpen = sheetOpen || menuOpen

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

  // Loot feed: mỗi món nhặt được một dòng "+N <tên>", tự tắt sau ít giây; stack bị
  // chặn trần để spam nhặt không tràn màn hình.
  const pushLoot = useCallback((picked: { item: ItemId; amount: Decimal }): void => {
    const key = lootKeyRef.current
    lootKeyRef.current += 1
    setLoot((current) => [...current, { key, ...picked }].slice(-LOOT_STACK_MAX))
    window.setTimeout(() => {
      setLoot((current) => current.filter((entry) => entry.key !== key))
    }, LOOT_LIFETIME_MS)
  }, [])

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

  // E toggles the bag/character sheet. Holding it must not machine-gun the panel,
  // and the modal sheets own the keyboard while they are up.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      if (event.key !== 'e' && event.key !== 'E') return
      if (isTypingTarget(event.target)) return
      if (document.querySelector('.modal-backdrop')) return
      setSheetOpen((open) => !open)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A full-screen overlay owns the screen: the walker stands still underneath it
  // (otherwise you would drift across the map blind and come back somewhere else).
  useEffect(() => {
    sceneHandle?.freezeWalk(overlayOpen)
  }, [sceneHandle, overlayOpen])

  const bridge = useMemo<SceneBridge>(
    () => ({
      highlight: (zoneId) => sceneHandle?.setHighlight(zoneId),
      panTo: (zoneId) => sceneHandle?.panTo(zoneId),
      player: () => sceneHandle?.player() ?? null,
      pickable: () => sceneHandle?.pickable() ?? null,
      focusPlayer: () => sceneHandle?.focusPlayer(),
      setWorking: (pose) => sceneHandle?.setWorking(pose),
    }),
    [sceneHandle],
  )

  const changeZoom = (level: number): void => {
    setZoomLevel(level)
    sceneHandle?.setZoomLevel(level)
  }

  return (
    <SceneBridgeContext.Provider value={bridge}>
      <div className="game">
        <div className="scene-host">
          <div className="scene-frame" ref={sceneHostRef} aria-hidden="true" />
          <TopBar />
          <div className="scene-controls">
            <button
              type="button"
              className={sheetOpen ? 'chip active' : 'chip'}
              title={text(UI.bagHint)}
              onClick={() => {
                setSheetOpen((open) => !open)
                playSound('click')
              }}
            >
              {text(UI.bag)}
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
            <button
              type="button"
              className="chip gear-chip"
              aria-label={text(UI.menu)}
              title={text(UI.menuHint)}
              onClick={() => {
                setMenuOpen(true)
                playSound('click')
              }}
            >
              ⚙
            </button>
          </div>
          <Minimap viewRef={viewRef} onJump={(x, y) => sceneHandle?.focusOn(x, y)} />
          {sheetOpen && (
            <InventoryPanel tab={sheetTab} onTabChange={setSheetTab} onClose={() => setSheetOpen(false)} />
          )}
          <ActionBar paused={overlayOpen} onLoot={pushLoot} />
          {loot.length > 0 && (
            <div className="loot-stack">
              {loot.map((entry) => (
                <LootToast key={entry.key} item={entry.item} amount={entry.amount} />
              ))}
            </div>
          )}
        </div>
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
        {menuOpen && (
          <MenuModal
            tab={menuTab}
            onTabChange={setMenuTab}
            zoom={zoomLevel}
            onZoom={changeZoom}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    </SceneBridgeContext.Provider>
  )
}
