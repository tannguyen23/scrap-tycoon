/**
 * A world-space rect as the camera currently sees it. Kept in the kit engine
 * itself (the scenery kit imports nothing outside `scenery/core`), so the
 * lighting grade, the LOD prop buckets and the ambience can all cull against the
 * viewport without learning about the ground kit's `Rect`.
 */
export interface ViewRect {
  x: number
  y: number
  width: number
  height: number
}

export function inflateRect(rect: ViewRect, pad: number): ViewRect {
  return { x: rect.x - pad, y: rect.y - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
}

export function intersectsRect(a: ViewRect, b: ViewRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function containsPoint(rect: ViewRect, x: number, y: number, pad = 0): boolean {
  return x >= rect.x - pad && x <= rect.x + rect.width + pad && y >= rect.y - pad && y <= rect.y + rect.height + pad
}
