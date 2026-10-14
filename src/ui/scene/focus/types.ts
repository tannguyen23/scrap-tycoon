import type { WorkerAction } from '@domain/types'
import type { Container } from 'pixi.js'
import type { TilePainter } from '@ground/core/painter'
import type { Wind } from '../weather'
import type { ZoneRect } from '../zoneLayout'

/** Plain point in a zone's local space (props, anchors, actor targets). */
export interface Spot {
  x: number
  y: number
}

/** Data the focused-zone scenes need on every store sync. */
export interface DetailSceneState {
  workers: number
  /**
   * Worker head-count per behaviour inside the zone (`{ pick: 3, haul: 1 }`).
   * A zone with several crewing behaviours picks which actor to spawn from
   * here — `workers` alone cannot say who hauls and who picks.
   */
  actions: Readonly<Partial<Record<WorkerAction, number>>>
  earnedLog10: number
  /** Vehicle/prop tier raised by owned upgrades (0 = base art). */
  tier: number
  /** Popup wording already translated to the active locale. */
  labels: { produced: string; money: string }
  /**
   * How full the zone's stock item is (0..1; -1 when that item has no cap).
   * Drives the visible bins/piles — a full bin is why upstream work stops.
   */
  stock01: number
}

/**
 * A high-detail scene drawn on top of a zone while the camera is zoomed in.
 * Detail art is authored at double density on a 1-unit grid, so it stays crisp
 * 1:1 at map zoom while carrying twice the pixels per object.
 */
export interface DetailScene {
  readonly root: Container
  setState(state: DetailSceneState): void
  update(dt: number, elapsed: number): void
  /** Gió toàn cục mỗi frame (thời tiết); zone nào không quan tâm thì bỏ qua. */
  setAmbient?(ambient: Wind): void
}

export type DetailSceneFactory = (rect: ZoneRect, tiles: TilePainter) => DetailScene
