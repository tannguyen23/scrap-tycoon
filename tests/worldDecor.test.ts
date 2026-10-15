import { describe, expect, it } from 'vitest'
import { DECOR_SPECIMENS, decorBox } from '@ground/packs/scrapYard/decorItems'
import { DECOR_PLACEMENTS } from '@ground/packs/scrapYard/decorPlacements'
import { ZONE_LAYOUTS, type ZoneRect } from '@ground/packs/scrapYard/worldLayout'

function overlaps(a: ZoneRect, b: ZoneRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

const SPECIMENS = new Map(DECOR_SPECIMENS.map((specimen) => [specimen.key, specimen]))

describe('world decor placement', () => {
  it('places only specimens the catalog knows', () => {
    for (const placement of DECOR_PLACEMENTS) {
      expect(SPECIMENS.has(placement.key), placement.key).toBe(true)
    }
  })

  it('keeps every hand-placed prop out of the zones', () => {
    for (const placement of DECOR_PLACEMENTS) {
      const specimen = SPECIMENS.get(placement.key)
      if (!specimen) continue
      const box = decorBox(specimen, placement.x, placement.y)
      for (const [zoneId, layout] of Object.entries(ZONE_LAYOUTS)) {
        expect(
          overlaps(box, layout.rect),
          `${placement.key} @ ${placement.x},${placement.y} chồng lên khu ${zoneId}`,
        ).toBe(false)
      }
    }
  })
})
