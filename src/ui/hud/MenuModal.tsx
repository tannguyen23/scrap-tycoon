import { UI } from '@i18n/text'
import { useContent, useGameState, useText } from '@ui/hooks'
import { playSound } from '@ui/sound/player'
import { useEffect } from 'react'
import { BranchPanel } from './BranchPanel'
import { MilestonePanel } from './MilestonePanel'
import { SettingsTab } from './SettingsTab'

/** Hai nửa của menu bánh răng: thứ bạn đang gây dựng, và cách game hành xử. */
export type MenuTab = 'progress' | 'settings'

export interface MenuModalProps {
  tab: MenuTab
  onTabChange: (tab: MenuTab) => void
  /** Current zoom stop (index into ZOOM_LEVELS) and its setter — the slider lives here. */
  zoom: number
  onZoom: (index: number) => void
  onClose: () => void
}

/**
 * Menu bánh răng: nâng cấp · mốc tiến trình · cài đặt nằm sau MỘT nút, để sân
 * chơi giữ trọn màn hình. Cùng tấm bảng gỗ ngày trước (sidebar cũ), giờ có tab
 * trên đầu thay vì luôn chiếm một cột.
 */
export function MenuModal({ tab, onTabChange, zoom, onZoom, onClose }: MenuModalProps) {
  const content = useContent()
  const state = useGameState()
  const text = useText()

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pick = (next: MenuTab): void => {
    if (next === tab) return
    onTabChange(next)
    playSound('click')
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="menu-panel" onClick={(event) => event.stopPropagation()}>
        <header className="menu-head">
          <span className="menu-title">{text(UI.menu)}</span>
          <div className="menu-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'progress'}
              className={tab === 'progress' ? 'chip active' : 'chip'}
              onClick={() => pick('progress')}
            >
              {text(UI.progress)}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'settings'}
              className={tab === 'settings' ? 'chip active' : 'chip'}
              onClick={() => pick('settings')}
            >
              {text(UI.settings)}
            </button>
          </div>
          <button type="button" className="chip" onClick={onClose}>
            {text(UI.close)}
          </button>
        </header>
        {tab === 'progress' ? (
          <main className="panels menu-panels">
            <MilestonePanel />
            {Object.values(content.branches).map((branch) => (
              <BranchPanel key={branch.id} branch={branch} state={state} onJump={onClose} />
            ))}
          </main>
        ) : (
          <SettingsTab zoom={zoom} onZoom={onZoom} />
        )}
      </div>
    </div>
  )
}
