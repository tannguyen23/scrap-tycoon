import type Decimal from 'break_eternity.js'
import type { L10n } from '@i18n/types'

export type ItemId = string
export type BranchId = string

export interface ItemDef {
  readonly id: ItemId
  readonly name: L10n
  readonly unit?: L10n
}

export interface WorkerDef {
  readonly id: string
  readonly name: L10n
  readonly baseCost: Decimal
  readonly costGrowth: Decimal
  /** Output per second, per single worker owned. */
  readonly output: { readonly item: ItemId; readonly ratePerUnit: Decimal }
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
