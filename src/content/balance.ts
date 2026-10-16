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
  /**
   * Step (s) used when offline must chunk because rates are state-dependent
   * (stock caps / transport legs). Online ticks at `tickSeconds`; this is the
   * offline approximation granularity.
   */
  offlineChunkSeconds: 1,
  /** Absences shorter than this are simulated silently (no welcome-back modal). */
  offlineModalThresholdSeconds: 60,
  /** rAF gaps longer than this are treated as an absence instead of ticks. */
  gapThresholdSeconds: 5,
  /** Starting wallet, enough to buy the first worker before hand work pays off. */
  startMoney: new Decimal(10),
} as const
