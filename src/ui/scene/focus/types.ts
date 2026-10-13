import type { Container } from 'pixi.js'
import type { TilePainter } from '../tiles/painter'
import type { ZoneRect } from '../zoneLayout'

/** Plain point in a zone's local space (props, anchors, actor targets). */
export interface Spot {
  x: number
  y: number
}

/** Data the focused-zone scenes need on every store sync. */
export interface DetailSceneState {
  workers: number
  earnedLog10: number
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
}

export type DetailSceneFactory = (rect: ZoneRect, tiles: TilePainter) => DetailScene
