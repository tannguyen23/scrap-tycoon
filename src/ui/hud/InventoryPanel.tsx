import { formatShort } from '@core/format'
import type { Result } from '@core/result'
import { isZoneUnlocked } from '@domain/conditions'
import { bagSlotRows, canAfford, gearRows, zoneStock } from '@domain/selectors'
import type { BagSlotRow, ZoneStockRow } from '@domain/selectors'
import type { GearSlot } from '@domain/types'
import { UI } from '@i18n/text'
import type { L10n } from '@i18n/types'
import { gearIcon, itemIcon } from '@ui/itemIcons'
import { useContent, useEngine, useGameState, useLocale, useSceneBridge, useText } from '@ui/hooks'
import { describeCondition } from '@ui/progression'
import { describeReason } from '@ui/reasons'
import { playSound } from '@ui/sound/player'
import { useEffect, useRef, useState, type DragEvent } from 'react'

/** Ô kho khu: mỗi khu chỉ giữ MỘT loại hàng (`domain/zones.ts`), một hàng là đủ. */
const BIN_SLOTS = 6

/** The modal E opens: goods in one tab, the character sheet in the other. */
export type SheetTab = 'items' | 'character'

/** What the player is dragging right now — a bag slot, or the standing yard's bin item. */
type DragSource = { kind: 'bag'; index: number } | { kind: 'bin'; itemId: string }

export interface InventoryPanelProps {
  tab: SheetTab
  onTabChange: (tab: SheetTab) => void
  onClose: () => void
}

/**
 * Túi đồ + trang bị của người chơi — mở bằng E, dựng như màn inventory của game
 * sinh tồn: nền tối đi, một tấm phiếu giữa màn hình, **hai tab**: "Túi đồ" (lưới ô
 * hàng đang mang + kho khu đang đứng) và "Nhân vật" (nón · áo · quần · dép · đang
 * cầm). Bấm chip trên đầu để chuyển tab, E hoặc Esc để đóng.
 *
 * Túi là **lưới ô**: mỗi ô một stack, kéo thả để dời/ghép/đổi chỗ, và kéo sang kho
 * khu đang đứng để bỏ hàng (hoặc kéo từ kho về túi). Chuyển được bao nhiêu do domain
 * quyết (`takeToBag`/`putFromBag`/`moveBagSlot` trả về số đã chuyển, hoặc lý do từ
 * chối) — ở đây không tự tính chỗ trống.
 */
export function InventoryPanel({ tab, onTabChange, onClose }: InventoryPanelProps) {
  const content = useContent()
  const engine = useEngine()
  const bridge = useSceneBridge()
  const text = useText()
  const locale = useLocale()
  const state = useGameState()

  const [zone, setZone] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragSource | null>(null)
  const zoneRef = useRef<string | null>(null)

  // Which warehouse this panel may touch is the yard the player stands in, polled
  // on its own clock like the work bar (a per-frame setState would re-render the
  // whole HUD while walking).
  useEffect(() => {
    let frame = 0
    const tick = (): void => {
      const standing = bridge.player()?.zone ?? null
      if (standing !== zoneRef.current) {
        zoneRef.current = standing
        setZone(standing)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [bridge])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const bagSlots = bagSlotRows(state, content)
  const yard = zone ? content.zones[zone] : undefined
  const stock = zone ? zoneStock(state, content, zone) : []
  const locked = zone !== null && yard !== undefined && !isZoneUnlocked(state, content, zone)
  const requirement = locked ? (yard?.requires ?? null) : null
  // "In hand" is what the job here would put in the character's hands (the kits
  // belong to the work action — `ui/scene/focus/poses.ts`).
  const heldJob = zone ? ((content.actions ?? []).find((action) => action.zone === zone) ?? null) : null

  const binCells: (ZoneStockRow | null)[] = stock.slice(0, BIN_SLOTS)
  while (binCells.length < BIN_SLOTS) binCells.push(null)

  const run = (move: () => Result<unknown>): void => {
    const result = move()
    if (result.ok) {
      setNote(null)
      playSound('click')
      return
    }
    const reason = describeReason(text, result.reason)
    setNote(reason || null)
    if (reason) playSound('deny')
  }

  // Switching tabs clears the last complaint: it belonged to the other tab's slots.
  const switchTab = (next: SheetTab): void => {
    if (next === tab) return
    setNote(null)
    onTabChange(next)
    playSound('click')
  }

  // ---- drag & drop ----------------------------------------------------------

  const onBagSlotDragOver = (event: DragEvent): void => {
    if (!drag) return
    event.preventDefault()
    event.dataTransfer.dropEffect = drag.kind === 'bag' ? 'move' : 'copy'
  }

  const onBagSlotDrop = (event: DragEvent, index: number): void => {
    event.preventDefault()
    const source = drag
    setDrag(null)
    if (!source) return
    if (source.kind === 'bag') {
      run(() => engine.moveBagSlot(source.index, index))
    } else if (zone === null) {
      setNote(text(UI.bagNoZone))
    } else {
      run(() => engine.takeToBag(zone, source.itemId))
    }
  }

  const onBinDragOver = (event: DragEvent): void => {
    if (!drag || drag.kind !== 'bag') return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const onBinDrop = (event: DragEvent): void => {
    event.preventDefault()
    const source = drag
    setDrag(null)
    if (!source || source.kind !== 'bag') return
    if (zone === null) {
      setNote(text(UI.bagNoZone))
      return
    }
    run(() => engine.putFromBag(zone, source.index))
  }

  const bagCell = (row: BagSlotRow) => {
    const item = content.items[row.itemId]
    const icon = itemIcon(row.itemId)
    const canStore = zone !== null && row.zone === zone
    const owner = row.zone ? content.zones[row.zone] : undefined
    const title = canStore
      ? text(UI.invStoreHint, { name: item ? text(item.name) : row.itemId })
      : text(UI.bagNeedZone, { zone: owner ? text(owner.name) : (row.zone ?? row.itemId) })
    const dragging = drag?.kind === 'bag' && drag.index === row.index
    return (
      <button
        key={`slot-${row.index}`}
        type="button"
        draggable
        className={`${slotClass(row.ratio)}${dragging ? ' is-dragging' : ''}`}
        title={title}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', String(row.index))
          setDrag({ kind: 'bag', index: row.index })
        }}
        onDragEnd={() => setDrag(null)}
        onDragOver={onBagSlotDragOver}
        onDrop={(event) => onBagSlotDrop(event, row.index)}
        onClick={() => run(() => engine.putFromBag(zone ?? '', row.index))}
      >
        {icon ? <img className="inv-icon" src={icon} alt="" /> : null}
        <span className="inv-amount">{formatShort(row.amount)}</span>
        <span className="inv-bar" role="img" aria-label={item ? text(item.name) : row.itemId}>
          <span className="inv-bar-fill" style={{ width: fillWidth(row.ratio) }} />
        </span>
      </button>
    )
  }

  const itemsSheet = (
    <>
      <h4 className="inv-sub">{text(UI.bagCarried)}</h4>
      <div className="inv-grid">
        {bagSlots.map((row, index) =>
          row ? (
            bagCell(row)
          ) : (
            <span
              key={`bag-empty-${index}`}
              className="inv-slot"
              aria-hidden="true"
              onDragOver={onBagSlotDragOver}
              onDrop={(event) => onBagSlotDrop(event, index)}
            />
          ),
        )}
      </div>
      {bagSlots.every((row) => row === null) && <p className="inv-empty">{text(UI.bagEmpty)}</p>}

      <h4 className="inv-sub">
        {yard ? `${text(UI.bagHere)} — ${text(yard.name)}` : text(UI.bagHere)}
      </h4>
      {zone === null ? (
        <p className="inv-empty">{text(UI.bagNoZone)}</p>
      ) : requirement ? (
        <p className="inv-empty">{describeCondition(text, locale, content, requirement)}</p>
      ) : (
        <div className="inv-grid">
          {binCells.map((row, index) => {
            const itemId = row?.itemId
            const item = itemId ? content.items[itemId] : undefined
            const icon = itemId ? itemIcon(itemId) : null
            const holding = row !== null && row.amount.gt(0)
            if (!holding) {
              return (
                <span
                  key={`bin-empty-${index}`}
                  className="inv-slot"
                  aria-hidden="true"
                  onDragOver={onBinDragOver}
                  onDrop={onBinDrop}
                />
              )
            }
            const dragging = drag?.kind === 'bin' && drag.itemId === itemId
            return (
              <button
                key={itemId}
                type="button"
                draggable
                className={`${slotClass(row.ratio)}${dragging ? ' is-dragging' : ''}`}
                title={item ? text(UI.invTakeHint, { name: text(item.name) }) : undefined}
                onDragStart={(event) => {
                  if (!itemId) return
                  event.dataTransfer.effectAllowed = 'copy'
                  event.dataTransfer.setData('text/plain', itemId)
                  setDrag({ kind: 'bin', itemId })
                }}
                onDragEnd={() => setDrag(null)}
                onDragOver={onBinDragOver}
                onDrop={onBinDrop}
                onClick={() => {
                  if (!itemId) return
                  run(() => engine.takeToBag(zone, itemId))
                }}
              >
                {icon ? <img className="inv-icon" src={icon} alt="" /> : null}
                <span className="inv-amount">{formatShort(row.amount)}</span>
                {row.cap ? (
                  <span className="inv-bar" role="img" aria-label={item ? text(item.name) : itemId}>
                    <span className="inv-bar-fill" style={{ width: fillWidth(row.ratio) }} />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </>
  )

  const characterSheet = (
    <>
      <h4 className="inv-sub">{text(UI.gear)}</h4>
      <div className="gear-grid">
        {gearRows(state, content).map((row) => {
          const piece = row.gear
          if (!piece) return null
          const icon = gearIcon(piece.id)
          const canBuy = row.cost !== null && canAfford(state, content, row.cost)
          return (
            <div key={row.slot} className={row.owned ? 'gear-cell is-worn' : 'gear-cell'}>
              <span className={row.owned ? 'inv-slot is-filled gear-slot-icon' : 'inv-slot gear-slot-icon'}>
                {row.owned && icon ? <img className="inv-icon" src={icon} alt="" /> : null}
              </span>
              <span className="gear-slot">{text(slotLabel(row.slot))}</span>
              <span className="gear-name">{text(piece.name)}</span>
              <span className="gear-desc">{text(piece.desc)}</span>
              {row.owned ? (
                <span className="gear-worn">{text(UI.gearWearing)}</span>
              ) : row.requirement ? (
                <span className="gear-locked">{describeCondition(text, locale, content, row.requirement)}</span>
              ) : (
                <button
                  type="button"
                  className="chip"
                  disabled={!canBuy}
                  title={text(piece.name)}
                  onClick={() => run(() => engine.buyGear(piece.id))}
                >
                  {text(UI.buy)} · {row.cost ? formatShort(row.cost) : ''}
                </button>
              )}
            </div>
          )
        })}
        <div className="gear-cell">
          <span className="inv-slot gear-slot-icon" aria-hidden="true" />
          <span className="gear-slot">{text(UI.gearHeld)}</span>
          <span className="gear-name">{heldJob ? text(heldJob.name) : text(UI.gearNone)}</span>
          <span className="gear-desc">{text(UI.gearHeldHint)}</span>
        </div>
      </div>
    </>
  )

  return (
    <div className="inv-backdrop" onClick={onClose}>
      <section
        className="inv-sheet"
        aria-label={text(UI.bag)}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="inv-head">
          <div className="inv-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'items'}
              className={tab === 'items' ? 'chip active' : 'chip'}
              onClick={() => switchTab('items')}
            >
              {text(UI.bag)}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'character'}
              className={tab === 'character' ? 'chip active' : 'chip'}
              onClick={() => switchTab('character')}
            >
              {text(UI.character)}
            </button>
          </div>
          <button type="button" className="chip" onClick={onClose}>
            {text(UI.close)}
          </button>
        </header>
        <p className="inv-hint">{tab === 'items' ? text(UI.invHint) : text(UI.gearHint)}</p>
        {note && <p className="inv-note">{note}</p>}
        {tab === 'items' ? itemsSheet : characterSheet}
      </section>
    </div>
  )
}

/** Slot name shown over each gear cell. */
function slotLabel(slot: GearSlot): L10n {
  if (slot === 'hat') return UI.gearHat
  if (slot === 'shirt') return UI.gearShirt
  if (slot === 'pants') return UI.gearPants
  return UI.gearBoots
}

/** Ô đầy thì viền đỏ như chip "Đầy" của thẻ khu; ô đang có hàng chỉ là ô đã tô. */
function slotClass(ratio: number | null): string {
  return ratio !== null && ratio >= 0.99 ? 'inv-slot is-filled is-full' : 'inv-slot is-filled'
}

function fillWidth(ratio: number | null): string {
  return `${Math.round((ratio ?? 0) * 100)}%`
}
