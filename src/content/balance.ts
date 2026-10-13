import { Decimal } from '@core/num'

/**
 * Global tunables. Every balance number lives in content — never in systems —
 * so the economy can be tuned (and re-locked by the golden test) without
 * touching game logic.
 */
export const BALANCE = {
  /** Fixed simulation step, in seconds. */
  tickSeconds: 0.1,
  /** Autosave interval, in seconds. */
  autosaveSeconds: 15,
  /** Maximum offline time credited, in hours. */
  offlineCapHours: 8,
  /** Absences shorter than this are simulated silently (no welcome-back modal). */
  offlineModalThresholdSeconds: 60,
  /** rAF gaps longer than this are treated as an absence instead of ticks. */
  gapThresholdSeconds: 5,
  /** Starting wallet, enough to buy the first worker (there is no click mechanic yet). */
  startMoney: new Decimal(10),
} as const
