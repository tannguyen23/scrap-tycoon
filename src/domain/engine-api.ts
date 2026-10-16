import type { Result } from '@core/result'
import type { ObservableStore } from '@core/store'
import type { BuyUpgradeValue, BuyWorkerValue, PerformActionValue } from './commands'
import type { OfflineReport } from './systems/offline'
import type { GameContent, GameState, MilestoneDef } from './types'

/**
 * Narrow port consumed by the UI. Implemented by the composition root in app/,
 * which keeps `ui` free of any dependency on `app` and keeps the game logic
 * (domain) free of React.
 */
export interface EngineApi {
  readonly content: GameContent
  readonly store: ObservableStore<GameState>
  buyWorker(branchId: string, workerId: string, qty: number | 'max'): Result<BuyWorkerValue>
  buyUpgrade(branchId: string, upgradeId: string): Result<BuyUpgradeValue>
  /** One stroke of hand work the player did on the map (hold-to-work bar). */
  performAction(actionId: string): Result<PerformActionValue>
  /** UI registers a handler; the loop pushes offline-earnings reports through it. */
  setOfflineReportHandler(handler: ((report: OfflineReport) => void) | null): void
  /** UI registers a handler; the engine pushes milestones reached this session through it. */
  setMilestoneHandler(handler: ((milestone: MilestoneDef) => void) | null): void
  resetSave(): void
}
