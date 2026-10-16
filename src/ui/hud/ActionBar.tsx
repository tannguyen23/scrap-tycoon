import { isZoneUnlocked } from '@domain/conditions'
import { getResource, getStock } from '@domain/state'
import type { Condition, ItemId, ManualActionDef, WorkPose } from '@domain/types'
import { zoneOfItem } from '@domain/zones'
import { UI } from '@i18n/text'
import { useContent, useEngine, useGameState, useLocale, useSceneBridge, useText } from '@ui/hooks'
import { describeCondition } from '@ui/progression'
import { playSound } from '@ui/sound/player'
import { useEffect, useRef, useState } from 'react'

/**
 * The work bar: what the player can do where they stand, and the hold-to-work
 * timer. It lives in the HUD (not the scene) because the *domain* side of a hand
 * job is a command — the bar keeps the clock, calls `performAction` when a stroke
 * fills, and tells the scene which animation to play.
 *
 * Everything frame-to-frame is written to refs and straight into the bar's CSS
 * width: a `setState` per frame would re-render the whole sidebar, and the readout
 * comes from a poll of `bridge.player()` for the same reason (like the minimap).
 */

/** The key that works by hand. */
export const WORK_KEY = 'E'
/** A stroke's progress when the bar is idle. */
const IDLE_PROGRESS = '0%'

export function ActionBar() {
  const content = useContent()
  const engine = useEngine()
  const bridge = useSceneBridge()
  const text = useText()
  const locale = useLocale()
  const state = useGameState()

  const [zone, setZone] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // The job on offer here: the first one the yard can pay for, falling back to
  // the one that gathers (content order is the priority — see content/actions.ts).
  const jobs = zone ? (content.actions ?? []).filter((action) => action.zone === zone) : []
  const held = (item: ItemId): ReturnType<typeof getResource> => {
    const owner = zoneOfItem(content, item)
    return owner ? getStock(state, owner, item) : getResource(state, item)
  }
  const job: ManualActionDef | null =
    jobs.find((action) => !action.input || held(action.input.item).gte(action.input.amount)) ?? jobs[0] ?? null
  const yard = zone ? content.zones[zone] : undefined
  const requirement: Condition | null =
    zone && yard && !isZoneUnlocked(state, content, zone) ? (yard.requires ?? null) : null

  const barRef = useRef<HTMLSpanElement | null>(null)
  const heldRef = useRef(false)
  const blockedRef = useRef(false)
  const elapsedRef = useRef(0)
  const poseRef = useRef<WorkPose | null>(null)
  const zoneRef = useRef<string | null>(null)
  const jobRef = useRef<ManualActionDef | null>(job)
  const lockedRef = useRef<boolean>(requirement !== null)
  const reasonRef = useRef<(reason: string) => string>(() => '')
  jobRef.current = job
  lockedRef.current = requirement !== null
  reasonRef.current = (reason) => {
    if (reason === 'no-input') return text(UI.reasonNoInput)
    if (reason === 'zone-full') return text(UI.reasonZoneFull)
    if (reason === 'locked') return text(UI.locked)
    return ''
  }

  useEffect(() => {
    const release = (): void => {
      elapsedRef.current = 0
      if (barRef.current) barRef.current.style.width = IDLE_PROGRESS
      if (poseRef.current !== null) {
        poseRef.current = null
        bridge.setWorking(null)
      }
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
      if (event.key !== WORK_KEY && event.key !== WORK_KEY.toLowerCase()) return
      // The settings sheet does not swallow keys (M still works); a work stroke
      // under an open modal would, so it is skipped here.
      if (document.querySelector('.modal-backdrop')) return
      heldRef.current = true
      blockedRef.current = false
      setNote(null)
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key !== WORK_KEY && event.key !== WORK_KEY.toLowerCase()) return
      heldRef.current = false
      blockedRef.current = false
      setNote(null)
      release()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let frame = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now

      const readout = bridge.player()
      const standing = readout?.zone ?? null
      if (standing !== zoneRef.current) {
        zoneRef.current = standing
        setZone(standing)
      }

      const action = jobRef.current
      const working =
        heldRef.current &&
        !blockedRef.current &&
        action !== null &&
        !lockedRef.current &&
        readout !== null &&
        !readout.moving

      if (!working) {
        if (poseRef.current !== null) release()
      } else {
        if (poseRef.current !== action.pose) {
          poseRef.current = action.pose
          bridge.setWorking(action.pose)
        }
        elapsedRef.current += dt
        const progress = Math.min(1, elapsedRef.current / action.workSeconds)
        if (barRef.current) barRef.current.style.width = `${Math.round(progress * 100)}%`
        if (progress >= 1) {
          elapsedRef.current = 0
          const result = engine.performAction(action.id)
          if (!result.ok) {
            // A full bin or an empty one stops the stroke: the key has to be
            // pressed again, which is also what clears this line.
            blockedRef.current = true
            const reason = reasonRef.current(result.reason)
            setNote(reason)
            if (reason) playSound('deny')
            release()
          }
        }
      }

      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (poseRef.current !== null) {
        poseRef.current = null
        bridge.setWorking(null)
      }
    }
  }, [bridge, engine])

  return (
    <div className="action-bar" role="status">
      {note ? (
        <span className="action-note">{note}</span>
      ) : requirement ? (
        <span className="action-locked">{describeCondition(text, locale, content, requirement)}</span>
      ) : job ? (
        <>
          <span className="action-line">{text(UI.workHold, { key: WORK_KEY, name: text(job.name) })}</span>
          <span className="cost-bar" role="img" aria-label={text(job.name)}>
            <span className="cost-bar-fill" ref={barRef} />
          </span>
          <span className="action-hint">{text(UI.workHint)}</span>
        </>
      ) : (
        <span className="action-line">{text(UI.moveHint)}</span>
      )}
    </div>
  )
}
