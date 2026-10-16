import { Container, Graphics } from 'pixi.js'
import { intersectsRect, type ViewRect } from './view'

/**
 * LOD prop layers — the sub-pixel decorations that only land on whole canvas
 * pixels past a zoom step (micro at 2×, nano at 4×). The kit owns the layer; the
 * pack owns the positions and the drawer, so a project's specks are data.
 */
export interface DetailProp {
  readonly x: number
  readonly y: number
  readonly kind: number
}

export type DetailDrawer = (g: Graphics, x: number, y: number, kind: number) => void

/** One layer of pre-generated props, bucketed so a big world culls by the view. */
export interface DetailLayer {
  readonly container: Container
  /** Shows only the buckets reaching into the view. */
  update(view: ViewRect): void
}

interface Bucket {
  readonly art: Graphics
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Props are grouped into world-anchored buckets (one Graphics each). Only the
 * buckets near the camera are visible, so a huge map pays per screen rather than
 * per world — while the art itself is still built once.
 */
export function createDetailLayer(props: readonly DetailProp[], draw: DetailDrawer, bucketSize = 512): DetailLayer {
  const container = new Container()
  const buckets = new Map<string, Bucket>()
  const slack = 8

  for (const prop of props) {
    const bx = Math.floor(prop.x / bucketSize)
    const by = Math.floor(prop.y / bucketSize)
    const key = `${bx},${by}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { art: new Graphics(), minX: prop.x, minY: prop.y, maxX: prop.x, maxY: prop.y }
      buckets.set(key, bucket)
      container.addChild(bucket.art)
    }
    bucket.minX = Math.min(bucket.minX, prop.x - slack)
    bucket.minY = Math.min(bucket.minY, prop.y - slack)
    bucket.maxX = Math.max(bucket.maxX, prop.x + slack)
    bucket.maxY = Math.max(bucket.maxY, prop.y + slack)
    draw(bucket.art, prop.x, prop.y, prop.kind)
  }

  return {
    container,
    update: (view: ViewRect): void => {
      for (const bucket of buckets.values()) {
        bucket.art.visible = intersectsRect(view, {
          x: bucket.minX,
          y: bucket.minY,
          width: bucket.maxX - bucket.minX,
          height: bucket.maxY - bucket.minY,
        })
      }
    },
  }
}
