import { blobContour } from '@ground/core/edgeGeometry'
import { DEFAULT_BLOB_PAD } from '@ground/core/grounds'
import { SCRAP_MAP } from '@ground/packs/scrapYard/worldGrounds'
import type { WaterBody } from '@scene/core/water'

/**
 * The map's waterlines, derived from the very blob calls the ground pass paints —
 * same rect, same pad, same seed. Shared by the scene's water life and by the
 * player's walkable map, so a ripple (or a blocked step) can never end up on
 * ground the map drew as bank.
 */
export function scrapWaterBodies(): WaterBody[] {
  return SCRAP_MAP.water.map((area) => ({
    center: { x: area.rect.x + area.rect.width / 2, y: area.rect.y + area.rect.height / 2 },
    contour: blobContour(area.rect, area.pad ?? DEFAULT_BLOB_PAD, area.seed),
  }))
}
