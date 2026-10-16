import { describe, expect, it } from 'vitest'
import { distanceToSegment } from '@ground/core/edgeGeometry'
import { DECOR_SPECIMENS, decorBox } from '@ground/packs/scrapYard/decorItems'
import { DECOR_PLACEMENTS } from '@ground/packs/scrapYard/decorPlacements'
import { SCRAP_MAP } from '@ground/packs/scrapYard/worldGrounds'
import {
  CONNECTORS,
  TRAILS,
  WATER_AREAS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
  type ZoneRect,
} from '@ground/packs/scrapYard/worldLayout'

function overlaps(a: ZoneRect, b: ZoneRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

const SPECIMENS = new Map(DECOR_SPECIMENS.map((specimen) => [specimen.key, specimen]))

/** Every painted surface a prop may not stand on: lanes, links, connectors. */
const PAINTED: readonly ZoneRect[] = [
  ...SCRAP_MAP.lanes.map((lane) => lane.rect),
  ...SCRAP_MAP.links.map((link) => link.rect),
  ...CONNECTORS,
]

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

  it('keeps every prop inside the world', () => {
    for (const placement of DECOR_PLACEMENTS) {
      expect(placement.x, `${placement.key} @ ${placement.x},${placement.y}`).toBeGreaterThanOrEqual(0)
      expect(placement.y).toBeGreaterThanOrEqual(0)
      expect(placement.x).toBeLessThan(WORLD_WIDTH)
      expect(placement.y).toBeLessThan(WORLD_HEIGHT)
    }
  })

  it('never stands a prop on water or on a painted road', () => {
    // Một cái cây giữa đại lộ hay một cây sồi nổi trên ao đọc ra là lỗi — vùng cấm
    // trong `decorPlacements` phải khớp đúng dữ liệu map (test này khoá lại).
    for (const placement of DECOR_PLACEMENTS) {
      const specimen = SPECIMENS.get(placement.key)
      if (!specimen) continue
      const box = decorBox(specimen, placement.x, placement.y)
      for (const area of WATER_AREAS) {
        expect(overlaps(box, area.rect), `${placement.key} @ ${placement.x},${placement.y} trên mặt nước`).toBe(false)
      }
      for (const painted of PAINTED) {
        expect(overlaps(box, painted), `${placement.key} @ ${placement.x},${placement.y} trên mặt đường`).toBe(false)
      }
      // Lối đi là đường gấp khúc nên phải đo bằng khoảng cách: một bụi nằm đúng ngã ba
      // là thứ làm mối nối trông sai, mà nhìn từ trên lại y như lỗi vẽ.
      for (const trail of TRAILS) {
        const reach = trail.width / 2
        let closest = Number.POSITIVE_INFINITY
        for (let i = 0; i + 1 < trail.points.length; i++) {
          const a = trail.points[i]
          const b = trail.points[i + 1]
          if (!a || !b) continue
          closest = Math.min(
            closest,
            distanceToSegment(placement.x, placement.y, a.x, a.y, b.x, b.y) - reach,
          )
        }
        expect(closest, `${placement.key} @ ${placement.x},${placement.y} trên lối đi`).toBeGreaterThan(0)
      }
    }
  })

  it('dresses the whole world, not only the core', () => {
    expect(DECOR_PLACEMENTS.length).toBeGreaterThan(400)
    const farWest = DECOR_PLACEMENTS.filter((placement) => placement.x < 3000).length
    const farEast = DECOR_PLACEMENTS.filter((placement) => placement.x > 7200).length
    const farSouth = DECOR_PLACEMENTS.filter((placement) => placement.y > 4000).length
    expect(farWest).toBeGreaterThan(40)
    expect(farEast).toBeGreaterThan(40)
    expect(farSouth).toBeGreaterThan(40)
  })
})
