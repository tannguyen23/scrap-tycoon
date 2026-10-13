import { FixedStepClock } from '@core/clock'
import type { Engine } from './engine'

export interface LoopOptions {
  /** Fixed simulation step, in seconds. */
  tickSeconds: number
  /** Autosave interval, in seconds. */
  autosaveSeconds: number
  /** rAF gaps longer than this go through the offline integrator instead of ticks. */
  gapThresholdSeconds: number
}

/**
 * rAF-driven loop: fixed domain ticks, periodic autosave, and absence catch-up.
 * A gap (hidden tab, device sleep) is credited through the exact offline
 * integrator instead of replaying thousands of ticks — same code path as
 * loading a save.
 */
export function startLoop(engine: Engine, options: LoopOptions): () => void {
  const clock = new FixedStepClock(options.tickSeconds)
  let lastFrameAt = performance.now()
  let secondsSinceSave = 0
  let frameHandle = 0

  const frame = (now: number): void => {
    const elapsed = (now - lastFrameAt) / 1000
    lastFrameAt = now

    if (elapsed > options.gapThresholdSeconds) {
      clock.reset()
      engine.applyElapsed(elapsed)
      secondsSinceSave = 0
    } else {
      const steps = clock.advance(elapsed)
      if (steps > 0) {
        engine.tick(steps * options.tickSeconds)
        secondsSinceSave += steps * options.tickSeconds
      }
      if (secondsSinceSave >= options.autosaveSeconds) {
        engine.saveNow()
        secondsSinceSave = 0
      }
    }

    frameHandle = requestAnimationFrame(frame)
  }
  frameHandle = requestAnimationFrame(frame)

  const onVisibilityChange = (): void => {
    if (document.hidden) engine.saveNow()
  }
  const onBeforeUnload = (): void => {
    engine.saveNow()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('beforeunload', onBeforeUnload)

  return () => {
    cancelAnimationFrame(frameHandle)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('beforeunload', onBeforeUnload)
  }
}
