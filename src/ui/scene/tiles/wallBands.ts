import { cliffBandEdges } from './edgeGeometry'
import type { GroundCanvas } from './groundCanvas'
import { terrainTones, type EdgeTones, type TileKind } from './terrain'

const AO = 0x2f2418
/** Wall depth on south / east edges of a raised plateau, in px. */
const FACE_DEPTH = 6
const SIDE_DEPTH = 4

/**
 * Wall of a raised plateau, as hard pixels along the contour.
 *
 * Only the south and east edges get one: viewed from the south, a plateau hides
 * its own back wall, so north/west keep just the sunlit crest. The wall is drawn
 * polygon-accurate (the tile grid would step it), which is what lets the crest
 * line, the strata and the cast shadow stay continuous.
 */
export function paintWallBands(g: GroundCanvas, points: readonly number[], inside: TileKind): void {
  const inner: EdgeTones = terrainTones(inside)

  for (const band of cliffBandEdges(points, FACE_DEPTH, SIDE_DEPTH)) {
    const dx = band.x2 - band.x1
    const dy = band.y2 - band.y1
    const length = Math.hypot(dx, dy)
    if (length < 1) continue
    const steps = Math.max(1, Math.round(length))

    for (let i = 0; i <= steps; i++) {
      const x = Math.round(band.x1 + (dx * i) / steps)
      const y = Math.round(band.y1 + (dy * i) / steps)
      g.rect(x, y - 1, 1, 1).fill({ color: inner.light, alpha: 0.9 })
      for (let d = 0; d < band.depth; d++) {
        const strata = (i + d) % 7 === 0
        g.rect(x, y + d, 1, 1).fill({
          color: d === 0 ? inner.rim : strata ? inner.rim : inner.depth,
          alpha: d === 0 ? 0.9 : strata ? 0.75 : 1,
        })
      }
      if (i % 4 < 3) g.rect(x, y + band.depth, 1, 1).fill({ color: 0x000000, alpha: 0.3 })
      for (let d = 1; d <= 3; d++) {
        g.rect(x + 2, y + band.depth + d, 1, 1).fill({ color: AO, alpha: d === 1 ? 0.16 : 0.1 })
      }
    }
  }
}