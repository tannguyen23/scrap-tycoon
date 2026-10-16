/**
 * What the kit needs to know about a game, per frame. The project computes this
 * from its own state and pushes it in — the kit never sees a store, a save or a
 * domain type, which is what makes the runtime liftable into another game.
 *
 * Everything here is already resolved: numbers, and text translated to the
 * active locale.
 */

/**
 * One piece of debris lying on a zone floor. The kit only carries it through: the
 * zone's own detail scene draws it at `(x, y)`, which are LOCAL to that zone.
 */
export interface LooseFeed {
  readonly id: number
  readonly item: string
  readonly x: number
  readonly y: number
}

/** One zone's readout, the input of that zone's detail scene. */
export interface ZoneFeed {
  /** Workers assigned to this zone. */
  readonly workers: number
  /**
   * Head-count per behaviour inside the zone (`{ pick: 3, haul: 1 }`). A zone
   * with several crewing behaviours picks which actor to spawn from here —
   * `workers` alone cannot say who hauls and who picks. Keys are the project's
   * own action names.
   */
  readonly actions: Readonly<Record<string, number>>
  /** Vehicle/prop tier raised by owned upgrades (0 = base art). */
  readonly tier: number
  /**
   * How full the zone's stock item is (0..1; -1 when that item has no cap).
   * Drives the visible bins/piles — a full bin is why upstream work stops.
   */
  readonly stock01: number
  /** Popup wording already translated to the active locale. */
  readonly labels: { readonly produced: string; readonly money: string }
  /**
   * Debris lying on this zone's floor. The kit only carries it through — the
   * zone's own detail scene places and draws each piece.
   */
  readonly loose?: readonly LooseFeed[]
}

/** The whole scene readout: per-zone feeds plus the globals art reacts to. */
export interface SceneFeed {
  /** Total play time, in seconds — drives the weather schedule. */
  readonly playTimeS: number
  /** log10 of total earned, for milestone-driven art (0 below 10). */
  readonly earnedLog10: number
  readonly zones: Readonly<Record<string, ZoneFeed>>
  /**
   * Owned count per production unit id (the project's own worker ids). Cross-zone
   * runs pick their share from here, so the kit never learns a unit id.
   */
  readonly workers: Readonly<Record<string, number>>
}
