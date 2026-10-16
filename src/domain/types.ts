import type Decimal from 'break_eternity.js'
import type { L10n } from '@i18n/types'

export type ItemId = string
export type BranchId = string
export type ZoneId = string
export type WeatherKind = string

export type WorkerAction = 'pick' | 'drive' | 'work' | 'haul'

/**
 * Pose a humanoid plays while working by hand — the shared `WorkAction`s in
 * `ui/scene/focus/poses.ts` (the same ones zone workers animate with).
 */
export type WorkPose = 'pick' | 'poke' | 'hammer'

/**
 * A progression condition — pure content data evaluated against the live state
 * (`domain/conditions.ts`). Conditions must stay monotonic (their progress never
 * decreases), so unlocks can never re-lock an existing save and milestones never
 * need a persisted "reached" flag.
 */
export type Condition =
  | { readonly kind: 'workers'; readonly branch: BranchId; readonly worker: string; readonly count: number }
  | { readonly kind: 'upgrade'; readonly branch: BranchId; readonly upgrade: string }
  | { readonly kind: 'totalEarned'; readonly amount: Decimal }
  | { readonly kind: 'playTime'; readonly seconds: number }

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
  /**
   * Stock ceiling (undefined/null = unbounded). Upgrades can raise it through the
   * `item.<id>.capacity` stat key; weather never shrinks a bin.
   */
  readonly cap?: Decimal | null
}

export interface ZoneDef {
  readonly id: ZoneId
  readonly name: L10n
  /** One-line description of what happens in this zone (shown on the HUD zone card). */
  readonly actionDesc: L10n
  /** Progression gate: the zone — and every worker living in it — stays locked until met. */
  readonly requires?: Condition
}

export interface WorkerDef {
  readonly id: string
  readonly name: L10n
  readonly baseCost: Decimal
  readonly costGrowth: Decimal
  /**
   * Optional consumption: the worker moves/converts `input` into `output`
   * (a transport leg or a processing step). Absent = pure producer, as before.
   */
  readonly input?: { readonly item: ItemId; readonly ratePerUnit: Decimal }
  /** Output per second, per single worker owned. */
  readonly output: { readonly item: ItemId; readonly ratePerUnit: Decimal }
  /** Presentation data: which zone it lives in and what it does there. */
  readonly visual: WorkerVisual
  /** Extra progression gate on top of the zone's own `requires`. */
  readonly requires?: Condition
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

/**
 * A job the player does by hand, in one place: hold the key for `workSeconds`
 * and the chain takes one stroke's worth. Unlike a worker this is an EVENT, not
 * a rate — the HUD owns the timer and calls the command when it fills, so the
 * simulation never has to know about it (no save field, no migration).
 */
export interface ManualActionDef {
  readonly id: string
  readonly name: L10n
  readonly desc: L10n
  /** The yard this job sits in — the player must be standing inside it. */
  readonly zone: ZoneId
  /** Animation the body plays while working. */
  readonly pose: WorkPose
  /** How long the key must be held for one stroke. */
  readonly workSeconds: number
  /** Consumed by one stroke (absent = pure gathering, like poking cans). */
  readonly input?: { readonly item: ItemId; readonly amount: Decimal }
  /** Produced by one stroke. */
  readonly output: { readonly item: ItemId; readonly amount: Decimal }
  /** Extra progression gate on top of the zone's own `requires`. */
  readonly requires?: Condition
}

export interface StatEffect {
  /** Stat key from `statKeys` — e.g. `branch.scrap.workerOutput`. */
  readonly target: string
  readonly kind: 'flat' | 'mult' | 'global'
  readonly value: Decimal
}

/** Presentation-only payload: raises the fleet art drawn in a zone (see `zoneTiers`). */
export interface UpgradeVisual {
  readonly zone: ZoneId
  /** Target vehicle tier for that zone (0 is the base look, so tiers start at 1). */
  readonly tier: number
}

export interface UpgradeDef {
  readonly id: string
  readonly name: L10n
  readonly desc: L10n
  readonly cost: Decimal
  readonly effects: readonly StatEffect[]
  readonly visual?: UpgradeVisual
  /** Progression gate: the upgrade stays locked until met. */
  readonly requires?: Condition
}

export interface BranchDef {
  readonly id: BranchId
  readonly name: L10n
  readonly workers: readonly WorkerDef[]
  readonly recipes: readonly RecipeDef[]
  readonly upgrades: readonly UpgradeDef[]
  /** Progression gate: the whole branch stays locked until met. */
  readonly requires?: Condition
}

/**
 * A progression goal: a condition plus an optional permanent reward. Reaching a
 * milestone is DERIVED from the state — no save field exists, and because
 * conditions are monotonic a reached milestone can never un-reach. The reward
 * feeds the modifier pipeline while the condition holds, like weather does.
 */
export interface MilestoneDef {
  readonly id: string
  readonly name: L10n
  readonly desc: L10n
  readonly requires: Condition
  readonly reward?: readonly StatEffect[]
}

/** Presentation parameters of one weather kind — consumed by the scene weather layer. */
export interface WeatherVisual {
  /** 0..1 — mây dày tới đâu (alpha/mật độ mây). */
  readonly cloudCover: number
  /** 0..1 — cường độ mưa (mật độ streak, splash, gợn ao, tiếng mưa). */
  readonly rain: number
  /** 0..~2 — sức gió (mây xiên/nhanh, cờ vẫy nhanh, khói xiêu, mưa nghiêng). */
  readonly wind: number
  /** Số lần sét trung bình mỗi block (0 = không sét). */
  readonly lightning: number
}

export interface WeatherKindDef {
  readonly id: WeatherKind
  readonly label: L10n
  /** Trọng số chọn giữa các block thời tiết. */
  readonly weight: number
  /** Hệ số tốc độ thợ khi đợt này đang diễn ra (áp qua global modifier). */
  readonly workMultiplier: number
  readonly visual: WeatherVisual
}

/**
 * Lịch thời tiết: thời gian chia thành các block cố định; mỗi block bốc một kind
 * theo weight (block 0 luôn là kind đầu tiên — "trời đẹp mở màn"). Thời tiết là
 * HÀM THUẦN của `playTimeS` nên không cần lưu vào save.
 */
export interface WeatherProfile {
  readonly blockSeconds: number
  /** Thời gian chuyển mượt hình ảnh ở đầu mỗi block. */
  readonly transitionSeconds: number
  readonly kinds: readonly WeatherKindDef[]
}

export interface GameContent {
  /** The item used as money (shown in the top bar, used to pay for everything). */
  readonly currencyItemId: ItemId
  readonly items: Record<ItemId, ItemDef>
  readonly zones: Record<ZoneId, ZoneDef>
  readonly branches: Record<BranchId, BranchDef>
  /** Optional progression goals; absent content means no milestones at all. */
  readonly milestones?: readonly MilestoneDef[]
  /** Optional hand-work jobs the player can do on the map. */
  readonly actions?: readonly ManualActionDef[]
  /** Optional weather schedule; absent content means no weather at all. */
  readonly weather?: WeatherProfile
  readonly simulation?: SimulationTuning
}

export interface SimulationTuning {
  /**
   * Step (s) used when offline must integrate chunk by chunk because rates are
   * state-dependent (stock caps, transport legs). Content owns the number.
   */
  readonly offlineChunkSeconds: number
}

export interface BranchState {
  workers: Record<string, number>
  upgrades: Record<string, true>
}

export interface GameState {
  /** Global pool: the currency and any item not tied to a zone warehouse. */
  resources: Record<ItemId, Decimal>
  /**
   * Per-zone warehouses. Which zone holds an item is derived from content
   * (`domain/zones.ts` — the bin in front of the worker that consumes it), so
   * item ↔ zone edits never need a save migration.
   */
  stock: Record<ZoneId, Record<ItemId, Decimal>>
  branches: Record<BranchId, BranchState>
  stats: {
    totalEarned: Decimal
    playTimeS: number
  }
}
