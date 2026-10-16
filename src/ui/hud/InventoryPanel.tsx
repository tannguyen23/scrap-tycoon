import { formatShort } from '@core/format'
import type { Result } from '@core/result'
import { isZoneUnlocked } from '@domain/conditions'
import { bagRows, canAfford, gearRows, zoneStock } from '@domain/selectors'
import type { ZoneStockRow } from '@domain/selectors'
import type { GearSlot, ItemDef } from '@domain/types'
import { UI } from '@i18n/text'
import type { L10n } from '@i18n/types'
import { gearIcon, itemIcon } from '@ui/itemIcons'
import { useContent, useEngine, useGameState, useLocale, useSceneBridge, useText } from '@ui/hooks'
import { describeCondition } from '@ui/progression'
import { describeReason } from '@ui/reasons'
import { playSound } from '@ui/sound/player'
import { useEffect, useRef, useState } from 'react'

/** Ô túi: 6 × 3 — nhiều ô nhưng ô nhỏ, cả tấm phiếu gọn trong màn. */
const BAG_SLOTS = 18
/** Ô kho khu: mỗi khu chỉ giữ MỘT loại hàng (`domain/zones.ts`), một hàng là đủ. */
const BIN_SLOTS = 6

/** The modal E opens: goods in one tab, the character sheet in the other. */
export type SheetTab = 'items' | 'character'

export interface InventoryPanelProps {
  tab: SheetTab
  onTabChange: (tab: SheetTab) => void
  onClose: () => void
}

/**
 * Túi đồ + trang bị của người chơi — mở bằng E, dựng như màn inventory của game
 * sinh tồn: nền tối đi, một tấm phiếu giữa màn hình, **hai tab**: "Túi đồ" (hàng
 * đang mang + kho khu đang đứng) và "Nhân vật" (nón · áo · quần · dép · đang cầm).
 * Bấm chip trên đầu để chuyển tab, E hoặc Esc để đóng.
 *
 * Bấm một ô là chuyển hàng: ô túi ⇒ bỏ vào kho khu đang đứng, ô kho ⇒ lấy vào túi.
 * Chuyển được bao nhiêu do domain quyết (`takeToBag`/`putFromBag` trả về số đã
 * chuyển, hoặc lý do từ chối) — ở đây không tự tính chỗ trống.
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

  const rows = bagRows(state, content)
  const carried = new Map(rows.map((row) => [row.itemId, row]))
  const yard = zone ? content.zones[zone] : undefined
  const stock = zone ? zoneStock(state, content, zone) : []
  const locked = zone !== null && yard !== undefined && !isZoneUnlocked(state, content, zone)
  const requirement = locked ? (yard?.requires ?? null) : null
  // "In hand" is what the job here would put in the character's hands (the kits
  // belong to the work action — `ui/scene/focus/poses.ts`).
  const heldJob = zone ? ((content.actions ?? []).find((action) => action.zone === zone) ?? null) : null

  // Slots keep their item for good (content order), so a bag never shuffles under
  // the player's hand; the spare cells are what makes it read as a bag with room.
  // What actually limits the bag is each item's `carry` ceiling, not the cell count.
  const carryable = Object.values(content.items).filter((item) => item.carry && item.id !== content.currencyItemId)
  const bagSlots: (ItemDef | null)[] = carryable.slice(0, BAG_SLOTS)
  while (bagSlots.length < BAG_SLOTS) bagSlots.push(null)
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

  const itemsSheet = (
    <>
      <h4 className="inv-sub">{text(UI.bagCarried)}</h4>
      <div className="inv-grid">
        {bagSlots.map((item, index) => {
          if (!item) return <span key={`spare-${index}`} className="inv-slot" aria-hidden="true" />
          const row = carried.get(item.id)
          const here = zone !== null && row?.zone === zone
          const owner = row?.zone ? content.zones[row.zone] : undefined
          const stored = stock.find((entry) => entry.itemId === item.id)
          const canStore = here && stored !== undefined
          const icon = itemIcon(item.id)
          const title = !row
            ? text(item.name)
            : canStore
              ? text(UI.invStoreHint, { name: text(item.name) })
              : text(UI.bagNeedZone, { zone: owner ? text(owner.name) : (row.zone ?? item.id) })
          return (
            <button
              key={item.id}
              type="button"
              className={slotClass(row !== undefined, row?.ratio ?? null)}
              disabled={!canStore}
              title={title}
              onClick={() => run(() => engine.putFromBag(zone ?? '', item.id))}
            >
              {row && icon ? <img className="inv-icon" src={icon} alt="" /> : null}
              {row ? <span className="inv-amount">{formatShort(row.amount)}</span> : null}
              {row && row.carry ? (
                <span className="inv-bar" role="img" aria-label={text(item.name)}>
                  <span className="inv-bar-fill" style={{ width: fillWidth(row.ratio) }} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {rows.length === 0 && <p className="inv-empty">{text(UI.bagEmpty)}</p>}

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
            if (!holding) return <span key={`spare-${index}`} className="inv-slot" aria-hidden="true" />
            return (
              <button
                key={itemId}
                type="button"
                className={slotClass(true, row.ratio)}
                title={item ? text(UI.invTakeHint, { name: text(item.name) }) : undefined}
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

/** Ô đầy thì viền đỏ như chip "Đầy" của thẻ khu; ô trống chỉ là ô trống. */
function slotClass(holding: boolean, ratio: number | null): string {
  if (!holding) return 'inv-slot'
  return ratio !== null && ratio >= 0.99 ? 'inv-slot is-filled is-full' : 'inv-slot is-filled'
}

function fillWidth(ratio: number | null): string {
  return `${Math.round((ratio ?? 0) * 100)}%`
}
