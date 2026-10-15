import type { Rect } from '@ground/core/metrics'
import type { TilePainter } from '@ground/core/painter'
import type { Container } from 'pixi.js'
import type { SceneWind } from '@scenery/core/ambience'
import type { ZoneFeed } from './feed'
import type { SceneServices } from './services'

/** Plain point in a zone's local space (props, anchors, actor targets). */
export interface Spot {
  x: number
  y: number
}

/** A zone's feed plus the global values its art reacts to. */
export interface DetailSceneState extends ZoneFeed {
  readonly earnedLog10: number
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
  setAmbient?(ambient: SceneWind): void
}

export type DetailSceneFactory = (
  rect: Rect,
  tiles: TilePainter,
  services: SceneServices,
) => DetailScene
