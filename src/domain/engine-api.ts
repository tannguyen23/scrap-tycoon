import type { Result } from '@core/result'
import type { ObservableStore } from '@core/store'
import type { BagMoveValue, BuyGearValue, BuyUpgradeValue, BuyWorkerValue, PerformActionValue, PickLooseValue } from './commands'
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
  /** Buys a piece of gear the character wears from then on (money only). */
  buyGear(gearId: string): Result<BuyGearValue>
  /** One stroke of hand work the player did on the map (hold-to-work bar). */
  performAction(actionId: string): Result<PerformActionValue>
  /** Picks up one piece of debris off a yard floor, by the id the scene reports. */
  pickLoose(looseId: number): Result<PickLooseValue>
  /** Picks goods up from the warehouse of the yard the player stands in. */
  takeToBag(zoneId: string, itemId: string): Result<BagMoveValue>
  /** Stores the stack sitting in one bag slot into the warehouse of the yard the player stands in. */
  putFromBag(zoneId: string, slotIndex: number): Result<BagMoveValue>
  /** Rearranges the bag (drag-and-drop): move a stack, merge same items, or swap two slots. */
  moveBagSlot(from: number, to: number): Result<null>
  /** UI registers a handler; the loop pushes offline-earnings reports through it. */
  setOfflineReportHandler(handler: ((report: OfflineReport) => void) | null): void
  /** UI registers a handler; the engine pushes milestones reached this session through it. */
  setMilestoneHandler(handler: ((milestone: MilestoneDef) => void) | null): void
  resetSave(): void
}
