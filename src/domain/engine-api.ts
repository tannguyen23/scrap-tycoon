import type { Result } from '@core/result'
import type { ObservableStore } from '@core/store'
import type { BuyUpgradeValue, BuyWorkerValue } from './commands'
import type { OfflineReport } from './systems/offline'
import type { GameContent, GameState } from './types'

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
  /** UI registers a handler; the loop pushes offline-earnings reports through it. */
  setOfflineReportHandler(handler: ((report: OfflineReport) => void) | null): void
  resetSave(): void
}
