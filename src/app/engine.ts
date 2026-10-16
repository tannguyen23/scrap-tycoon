import type Decimal from 'break_eternity.js'
import { fail, type Result } from '@core/result'
import type { SaveManager } from '@core/save/saveManager'
import type { ObservableStore } from '@core/store'
import { buyUpgrade, buyWorker, performAction, type BuyUpgradeValue, type BuyWorkerValue, type PerformActionValue } from '@domain/commands'
import type { EngineApi } from '@domain/engine-api'
import { completedMilestoneIds, newlyCompletedMilestones } from '@domain/milestones'
import { createFreshState, stateToSerialized } from '@domain/state'
import { applyOfflineProgress, type OfflineReport } from '@domain/systems/offline'
import { runTick } from '@domain/tick'
import type { GameContent, GameState, MilestoneDef } from '@domain/types'

export interface EngineOptions {
  content: GameContent
  store: ObservableStore<GameState>
  saveManager: SaveManager
  /** Wallet a freshly reset run starts with (same number bootstrap seeds a new game with). */
  startMoney: Decimal
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
  private readonly startMoney: Decimal
  private readonly offlineCapSeconds: number
  private readonly offlineModalThresholdSeconds: number
  private offlineReportHandler: ((report: OfflineReport) => void) | null = null
  private milestoneHandler: ((milestone: MilestoneDef) => void) | null = null
  /** Baseline of already-reached milestones: a load never re-announces old goals. */
  private knownMilestones: Set<string>

  constructor(options: EngineOptions) {
    this.content = options.content
    this.store = options.store
    this.saveManager = options.saveManager
    this.startMoney = options.startMoney
    this.offlineCapSeconds = options.offlineCapSeconds
    this.offlineModalThresholdSeconds = options.offlineModalThresholdSeconds
    this.knownMilestones = completedMilestoneIds(this.store.getSnapshot(), this.content)
  }

  buyWorker(branchId: string, workerId: string, qty: number | 'max'): Result<BuyWorkerValue> {
    let result: Result<BuyWorkerValue> | undefined
    this.store.update((draft) => {
      result = buyWorker(draft, this.content, branchId, workerId, qty)
    })
    this.syncMilestones()
    return result ?? fail('command-did-not-run')
  }

  buyUpgrade(branchId: string, upgradeId: string): Result<BuyUpgradeValue> {
    let result: Result<BuyUpgradeValue> | undefined
    this.store.update((draft) => {
      result = buyUpgrade(draft, this.content, branchId, upgradeId)
    })
    this.syncMilestones()
    return result ?? fail('command-did-not-run')
  }

  performAction(actionId: string): Result<PerformActionValue> {
    let result: Result<PerformActionValue> | undefined
    this.store.update((draft) => {
      result = performAction(draft, this.content, actionId)
    })
    this.syncMilestones()
    return result ?? fail('command-did-not-run')
  }

  tick(dt: number): void {
    this.store.update((draft) => {
      runTick(draft, this.content, dt)
    })
    this.syncMilestones()
  }

  /** Credits an absence (reload gap, background tab return, device sleep). */
  applyElapsed(elapsedSeconds: number): OfflineReport {
    let report: OfflineReport | undefined
    this.store.update((draft) => {
      report = applyOfflineProgress(draft, this.content, elapsedSeconds, this.offlineCapSeconds)
    })
    if (!report) throw new Error('offline progress was not applied')
    this.syncMilestones()
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

  /**
   * Wipes the save AND rebuilds the live state in place. Clearing memory is what
   * makes the reset stick: the page reload right after fires the loop's
   * unload/visibility autosave, and with the old snapshot still in memory that
   * autosave would write the old progress straight back over the cleared slot.
   */
  resetSave(): void {
    this.saveManager.clear()
    const fresh = createFreshState(this.content, this.startMoney)
    this.store.setState(fresh)
    this.knownMilestones = completedMilestoneIds(fresh, this.content)
  }

  setOfflineReportHandler(handler: ((report: OfflineReport) => void) | null): void {
    this.offlineReportHandler = handler
  }

  setMilestoneHandler(handler: ((milestone: MilestoneDef) => void) | null): void {
    this.milestoneHandler = handler
  }

  /** Announces milestones reached since the last check (in-memory diff, no save flags). */
  private syncMilestones(): void {
    const state = this.store.getSnapshot()
    const fresh = newlyCompletedMilestones(this.knownMilestones, state, this.content)
    if (fresh.length === 0) return
    for (const milestone of fresh) this.knownMilestones.add(milestone.id)
    if (!this.milestoneHandler) return
    for (const milestone of fresh) this.milestoneHandler(milestone)
  }
}
