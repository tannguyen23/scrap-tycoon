import { isZoneUnlocked } from '@domain/conditions'
import { playerWorkSpeed } from '@domain/selectors'
import { getBag, getResource, getStock } from '@domain/state'
import type { Condition, ItemId, ManualActionDef, WorkPose } from '@domain/types'
import { zoneOfItem } from '@domain/zones'
import { UI } from '@i18n/text'
import { useContent, useEngine, useGameState, useLocale, useSceneBridge, useText } from '@ui/hooks'
import { describeCondition } from '@ui/progression'
import { describeReason } from '@ui/reasons'
import type { PickableLoose } from '@ui/scene/player'
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
export const WORK_KEY = 'F'
/** A stroke's progress when the bar is idle. */
const IDLE_PROGRESS = '0%'
/** Picking a piece of debris off the floor is a quick scoop, not a full stroke. */
const PICK_SECONDS = 0.45

export interface ActionBarProps {
  /** True while a panel that owns the keyboard is open (the bag) — no strokes then. */
  paused?: boolean
}

export function ActionBar({ paused = false }: ActionBarProps) {
  const content = useContent()
  const engine = useEngine()
  const bridge = useSceneBridge()
  const text = useText()
  const locale = useLocale()
  const state = useGameState()

  const [zone, setZone] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [pickable, setPickable] = useState<PickableLoose | null>(null)

  // The job on offer here: the first one the yard can pay for, falling back to
  // the one that gathers (content order is the priority — see content/actions.ts).
  // A stroke spends the bag first, so loot already carried counts as payment.
  const jobs = zone ? (content.actions ?? []).filter((action) => action.zone === zone) : []
  const held = (item: ItemId): ReturnType<typeof getResource> => {
    const owner = zoneOfItem(content, item)
    const stored = owner ? getStock(state, owner, item) : getResource(state, item)
    return stored.add(getBag(state, item))
  }
  const job: ManualActionDef | null =
    jobs.find((action) => !action.input || held(action.input.item).gte(action.input.amount)) ?? jobs[0] ?? null
  // Gear can speed hand work up; the number comes from the modifier pipeline.
  const workSpeed = playerWorkSpeed(state, content).toNumber() || 1
  const yard = zone ? content.zones[zone] : undefined
  const requirement: Condition | null =
    zone && yard && !isZoneUnlocked(state, content, zone) ? (yard.requires ?? null) : null

  const barRef = useRef<HTMLSpanElement | null>(null)
  const heldRef = useRef(false)
  const blockedRef = useRef(false)
  const elapsedRef = useRef(0)
  const poseRef = useRef<WorkPose | null>(null)
  const zoneRef = useRef<string | null>(null)
  const pickRef = useRef<PickableLoose | null>(null)
  const jobRef = useRef<ManualActionDef | null>(job)
  const lockedRef = useRef<boolean>(requirement !== null)
  const pausedRef = useRef<boolean>(paused)
  const reasonRef = useRef<(reason: string) => string>(() => '')
  const speedRef = useRef(workSpeed)
  jobRef.current = job
  lockedRef.current = requirement !== null
  reasonRef.current = (reason) => describeReason(text, reason)
  // Set from an effect rather than during render: the rAF loop below is the only
  // reader, and the bar already keeps the keys it needs out of its dependency list.
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])
  useEffect(() => {
    speedRef.current = workSpeed > 0 ? workSpeed : 1
  }, [workSpeed])

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
      // under an open modal would, so it is skipped here. The bag panel is not a
      // modal but it does own the keyboard, so it pauses strokes the same way.
      if (document.querySelector('.modal-backdrop') || pausedRef.current) return
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
      // A piece of debris in reach outranks the yard's own job: you are standing on
      // it, so F should pick it up.
      const target = bridge.pickable()
      if (target?.id !== pickRef.current?.id) {
        pickRef.current = target
        setPickable(target)
      }

      const action = jobRef.current
      const working =
        heldRef.current &&
        !blockedRef.current &&
        !pausedRef.current &&
        (target !== null || action !== null) &&
        !lockedRef.current &&
        readout !== null &&
        !readout.moving

      if (!working) {
        if (poseRef.current !== null) release()
      } else {
        const pose: WorkPose = target ? 'pick' : (action?.pose ?? 'pick')
        const seconds = target ? PICK_SECONDS : (action?.workSeconds ?? PICK_SECONDS)
        if (poseRef.current !== pose) {
          poseRef.current = pose
          bridge.setWorking(pose)
        }
        elapsedRef.current += dt
        const progress = Math.min(1, elapsedRef.current / (seconds / speedRef.current))
        if (barRef.current) barRef.current.style.width = `${Math.round(progress * 100)}%`
        if (progress >= 1) {
          elapsedRef.current = 0
          const result = target
            ? engine.pickLoose(target.id)
            : action
              ? engine.performAction(action.id)
              : null
          if (result && !result.ok) {
            // A full bag or a full bin stops the stroke: the key has to be pressed
            // again, which is also what clears this line.
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

  const itemLabel = (itemId: string): string => {
    const name = content.items[itemId]?.name
    return name ? text(name) : itemId
  }

  return (
    <div className="action-bar" role="status">
      {note ? (
        <span className="action-note">{note}</span>
      ) : pickable ? (
        <>
          <span className="action-line">
            {text(UI.pickUp, { key: WORK_KEY, name: itemLabel(pickable.item) })}
          </span>
          <span className="cost-bar" role="img" aria-label={itemLabel(pickable.item)}>
            <span className="cost-bar-fill" ref={barRef} />
          </span>
          <span className="action-hint">{text(UI.workHint)}</span>
        </>
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
