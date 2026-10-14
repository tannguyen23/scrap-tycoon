import { Container, Graphics } from 'pixi.js'

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

/** One layer of pre-generated props, drawn through the pack's own drawer. */
export function createDetailLayer(props: readonly DetailProp[], draw: DetailDrawer): Container {
  const layer = new Container()
  const art = new Graphics()
  for (const prop of props) draw(art, prop.x, prop.y, prop.kind)
  layer.addChild(art)
  return layer
}
