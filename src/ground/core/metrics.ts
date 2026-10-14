/** Shared ground metrics of the tile kit — no project data lives here. */

/** Tile edge, in design px. The whole generation pipeline is locked to it. */
export const TILE_SIZE = 16

/** Plain axis-aligned rectangle (zone rects, patch rects, lane rects…). */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** True khi (x, y) rơi vào một trong các rect — dùng cho vùng cấm của lớp rải random. */
export function insideAnyRect(rects: readonly Rect[], x: number, y: number): boolean {
  for (const rect of rects) {
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return true
  }
  return false
}
