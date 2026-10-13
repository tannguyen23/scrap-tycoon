import { fail, type Result } from '@core/result'
import type { SaveManager } from '@core/save/saveManager'
import type { ObservableStore } from '@core/store'
import { buyUpgrade, buyWorker, type BuyUpgradeValue, type BuyWorkerValue } from '@domain/commands'
import type { EngineApi } from '@domain/engine-api'
import { stateToSerialized } from '@domain/state'
import { applyOfflineProgress, type OfflineReport } from '@domain/systems/offline'
import { runTick } from '@domain/tick'
import type { GameContent, GameState } from '@domain/types'

export interface EngineOptions {
  content: GameContent
  store: ObservableStore<GameState>
  saveManager: SaveManager
  offlineCapSeconds: number
  offlineModalThresholdSeconds: number
}

/**
 * Composition root of the running game: commands in, saves out. The UI talks to
 * it through the narrow `EngineApi` port.
 */
export class Engine implements EngineApi {
  readonly content: GameContent
  readonly store: ObservableStore<GameState>

  private readonly saveManager: SaveManager
  private readonly offlineCapSeconds: number
  private readonly offlineModalThresholdSeconds: number
  private offlineReportHandler: ((report: OfflineReport) => void) | null = null

  constructor(options: EngineOptions) {
    this.content = options.content
    this.store = options.store
    this.saveManager = options.saveManager
    this.offlineCapSeconds = options.offlineCapSeconds
    this.offlineModalThresholdSeconds = options.offlineModalThresholdSeconds
  }

  buyWorker(branchId: string, workerId: string, qty: number | 'max'): Result<BuyWorkerValue> {
    let result: Result<BuyWorkerValue> | undefined
    this.store.update((draft) => {
      result = buyWorker(draft, this.content, branchId, workerId, qty)
    })
    return result ?? fail('command-did-not-run')
  }

  buyUpgrade(branchId: string, upgradeId: string): Result<BuyUpgradeValue> {
    let result: Result<BuyUpgradeValue> | undefined
    this.store.update((draft) => {
      result = buyUpgrade(draft, this.content, branchId, upgradeId)
    })
    return result ?? fail('command-did-not-run')
  }

  tick(dt: number): void {
    this.store.update((draft) => {
      runTick(draft, this.content, dt)
    })
  }

  /** Credits an absence (reload gap, background tab return, device sleep). */
  applyElapsed(elapsedSeconds: number): OfflineReport {
    let report: OfflineReport | undefined
    this.store.update((draft) => {
      report = applyOfflineProgress(draft, this.content, elapsedSeconds, this.offlineCapSeconds)
    })
    if (!report) throw new Error('offline progress was not applied')
    if (this.shouldAnnounceOffline(report)) {
      this.offlineReportHandler?.(report)
    }
    return report
  }

  shouldAnnounceOffline(report: OfflineReport): boolean {
    return report.effectiveSeconds >= this.offlineModalThresholdSeconds && report.earned.gt(0)
  }

  saveNow(): void {
    this.saveManager.write(stateToSerialized(this.store.getSnapshot()), Date.now())
  }

  resetSave(): void {
    this.saveManager.clear()
  }

  setOfflineReportHandler(handler: ((report: OfflineReport) => void) | null): void {
    this.offlineReportHandler = handler
  }
}
