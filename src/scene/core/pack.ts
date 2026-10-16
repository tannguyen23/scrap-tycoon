import type { Rect } from '@ground/core/metrics'
import type { TilePainter } from '@ground/core/painter'
import type { GroundPack } from '@ground/core/pack'
import type { SceneryPack } from '@scenery/core/pack'
import type { SceneWind } from '@scenery/core/ambience'
import type { ViewRect } from '@scenery/core/view'
import type { Container, Graphics } from 'pixi.js'
import type { SceneFeed } from './feed'
import type { SceneServices } from './services'
import type { DetailSceneFactory } from './types'
import type { WaterLayer } from './water'

/** A zone as the camera sees it: where it is, and its hover-outline colour. */
export interface SceneZone {
  readonly rect: Rect
  /** Pixi fill colour of the hover outline. */
  readonly color: number
}

/**
 * How a pack paints its ground. Same call the game uses at map level, so the
 * pack, the game and the studio always draw one world. The optional `window`
 * restricts the pass to a rect — that is what lets a big world be painted chunk
 * by chunk (see `chunks.ts`); painting stays position-anchored, so the window
 * never changes what a given spot looks like.
 */
export interface SceneGround {
  readonly pack: GroundPack
  paint(painter: TilePainter, ground: Container, decor: Graphics, window?: Rect): void
}

/**
 * A layer the project owns inside the world: one container in world space plus a
 * per-frame update. The player is one; couriers are one with a feed on top.
 */
export interface WorldLayer {
  readonly root: Container
  /** `view` is the world rect on screen. */
  update(dt: number, view: Rect): void
  /** Optional teardown (listeners, timers) — the kit calls it on unmount. */
  destroy?(): void
}

/** Cross-zone deliveries. Locomotion is the kit's; runs and art are the pack's. */
export interface Couriers extends WorldLayer {
  /** Live counts, pushed whenever the project's state changes. */
  setFeed(feed: SceneFeed): void
}

/** Weather visuals. Machinery is the kit's; the schedule and ponds are the pack's. */
export interface Weather {
  /** Clouds and rain — added before the day/night grade so they take its tint. */
  readonly container: Container
  /** Lightning — added after the grade so it is not multiplied dark. */
  readonly flash: Container
  /** `view` (the world rect on screen) keeps clouds, rain and grade screen-sized. */
  update(dt: number, playTimeS: number, view?: ViewRect): void
  wind(): SceneWind
  dispose(): void
}

/**
 * Everything the scene kit needs to render one project's world. Same seam as the
 * ground and scenery kits: `scene/core` never imports a pack or the game, and a
 * pack never imports another pack — that is what makes the kit liftable.
 */
export interface ScenePack {
  readonly id: string
  readonly label: string
  readonly world: { readonly width: number; readonly height: number }
  /**
   * Canvas size in design px. A world bigger than the viewport is painted in
   * chunks and panned by the camera; absent means the viewport is the world
   * (small maps keep the whole-map-in-frame look).
   */
  readonly viewport?: { readonly width: number; readonly height: number }
  /** Zone rects + outline colour, for culling, `panTo` and `setHighlight`. */
  readonly zones: Readonly<Record<string, SceneZone>>
  readonly ground: SceneGround
  /** Lights, smoke/birds and the two LOD prop layers — the shell builds them. */
  readonly scenery: SceneryPack
  /** Zone ids that have a detail scene; the rest keep their map-level art. */
  readonly details: Readonly<Record<string, DetailSceneFactory>>
  /**
   * Still water the scene keeps alive — glints that wink and slow rings. The pack
   * supplies the waterlines and the project's own water tones; the kit animates.
   */
  readonly water?: WaterLayer
  /**
   * The player's layer: a world-space container the kit draws right under the
   * couriers and updates every frame. The pack owns the body, the art and the
   * input it reads; the camera follows it through `SceneHandle.setFollow`.
   */
  makePlayer?(services: SceneServices): WorldLayer | null
  makeCouriers?(services: SceneServices): Couriers | null
  makeWeather?(services: SceneServices): Weather | null
}

/** Boot-time wiring checks — catches a detail scene keyed on a zone that is not declared. */
export function validateScenePack(pack: ScenePack): string[] {
  const errors: string[] = []
  if (!pack.id) errors.push('scene pack id must not be empty')
  if (!(pack.world.width > 0) || !(pack.world.height > 0)) {
    errors.push(`scene pack "${pack.id}" needs a positive world size`)
  }
  if (Object.keys(pack.zones).length === 0) errors.push(`scene pack "${pack.id}" has no zones`)
  if (!pack.ground.pack.id) errors.push(`scene pack "${pack.id}" has no ground pack`)
  if (!pack.scenery.id) errors.push(`scene pack "${pack.id}" has no scenery pack`)
  for (const zoneId of Object.keys(pack.details)) {
    if (!pack.zones[zoneId]) {
      errors.push(`scene pack "${pack.id}" has a detail scene for unknown zone "${zoneId}"`)
    }
  }
  for (const [index, body] of (pack.water?.bodies ?? []).entries()) {
    if (body.contour.length < 6 || body.contour.length % 2 !== 0) {
      errors.push(`scene pack "${pack.id}" water body ${index} needs a contour of at least 3 x,y pairs`)
    }
  }
  return errors
}
