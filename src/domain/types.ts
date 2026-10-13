import type Decimal from 'break_eternity.js'
import type { L10n } from '@i18n/types'

export type ItemId = string
export type BranchId = string
export type ZoneId = string

export type WorkerAction = 'pick' | 'drive' | 'work' | 'haul'

export interface WorkerVisual {
  /** Zone the worker operates in; the scene layout is keyed by this id. */
  readonly zone: ZoneId
  /** What the actor does on the map — drives its animation behaviour. */
  readonly action: WorkerAction
}

export interface ItemDef {
  readonly id: ItemId
  readonly name: L10n
  readonly unit?: L10n
}

export interface ZoneDef {
  readonly id: ZoneId
  readonly name: L10n
  /** One-line description of what happens in this zone (shown on the HUD zone card). */
  readonly actionDesc: L10n
}

export interface WorkerDef {
  readonly id: string
  readonly name: L10n
  readonly baseCost: Decimal
  readonly costGrowth: Decimal
  /** Output per second, per single worker owned. */
  readonly output: { readonly item: ItemId; readonly ratePerUnit: Decimal }
  /** Presentation data: which zone it lives in and what it does there. */
  readonly visual: WorkerVisual
}

export interface RecipeDef {
  readonly id: string
  readonly name: L10n
  /**
   * `rate: null` = unlimited throughput (consume everything available);
   * otherwise max input units per second.
   */
  readonly input: { readonly item: ItemId; readonly rate: Decimal | null }
  /** Output produced per one unit of input consumed. */
  readonly output: { readonly item: ItemId; readonly perInputUnit: Decimal }
}

export interface StatEffect {
  /** Stat key from `statKeys` — e.g. `branch.scrap.workerOutput`. */
  readonly target: string
  readonly kind: 'flat' | 'mult' | 'global'
  readonly value: Decimal
}

export interface UpgradeDef {
  readonly id: string
  readonly name: L10n
  readonly desc: L10n
  readonly cost: Decimal
  readonly effects: readonly StatEffect[]
}

export interface BranchDef {
  readonly id: BranchId
  readonly name: L10n
  readonly workers: readonly WorkerDef[]
  readonly recipes: readonly RecipeDef[]
  readonly upgrades: readonly UpgradeDef[]
}

export interface GameContent {
  /** The item used as money (shown in the top bar, used to pay for everything). */
  readonly currencyItemId: ItemId
  readonly items: Record<ItemId, ItemDef>
  readonly zones: Record<ZoneId, ZoneDef>
  readonly branches: Record<BranchId, BranchDef>
}

export interface BranchState {
  workers: Record<string, number>
  upgrades: Record<string, true>
}

export interface GameState {
  resources: Record<ItemId, Decimal>
  branches: Record<BranchId, BranchState>
  stats: {
    totalEarned: Decimal
    playTimeS: number
  }
}
