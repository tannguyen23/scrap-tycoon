import { describe, expect, it } from 'vitest'
import { PRIMARY_TERRAINS } from '@ui/scene/tiles/terrain'
import {
  CLEARINGS,
  CONNECTORS,
  WATER_AREAS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
  type ZoneRect,
} from '@ui/scene/zoneLayout'

const zones = Object.entries(ZONE_LAYOUTS).map(([id, layout]) => ({ id, rect: layout.rect }))
const ponds = WATER_AREAS.map((area) => area.rect)

function overlaps(a: ZoneRect, b: ZoneRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function inside(rect: ZoneRect): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= WORLD_WIDTH &&
    rect.y + rect.height <= WORLD_HEIGHT
  )
}

function contains(outer: ZoneRect, inner: ZoneRect, margin: number): boolean {
  return (
    outer.x <= inner.x - margin &&
    outer.y <= inner.y - margin &&
    inner.x + inner.width + margin <= outer.x + outer.width &&
    inner.y + inner.height + margin <= outer.y + outer.height
  )
}

describe('map layout', () => {
  it('is roomy enough for four zones plus open ground', () => {
    expect(WORLD_WIDTH).toBeGreaterThanOrEqual(1280)
    expect(WORLD_HEIGHT).toBeGreaterThanOrEqual(720)
  })

  it('keeps every zone, connector, clearing and pond inside the world', () => {
    for (const { id, rect } of zones) expect(inside(rect), id).toBe(true)
    CONNECTORS.forEach((rect, index) => expect(inside(rect), `connector ${index}`).toBe(true))
    CLEARINGS.forEach((patch, index) => expect(inside(patch.rect), `clearing ${index}`).toBe(true))
    ponds.forEach((rect, index) => expect(inside(rect), `water ${index}`).toBe(true))
  })

  it('never lets zones overlap each other', () => {
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const a = zones[i]
        const b = zones[j]
        if (!a || !b) continue
        expect(overlaps(a.rect, b.rect), `${a.id} vs ${b.id}`).toBe(false)
      }
    }
  })

  it('keeps ponds out of the zones and off the connectors', () => {
    for (const rect of ponds) {
      for (const { id, rect: zone } of zones) expect(overlaps(rect, zone), id).toBe(false)
      for (const connector of CONNECTORS) expect(overlaps(rect, connector)).toBe(false)
    }
  })

  it('digs the muddy ponds into a dirt clearing (the water ↔ dirt pair)', () => {
    const muddy = WATER_AREAS.filter((area) => area.outside === 'dirt')
    expect(muddy.length).toBeGreaterThan(0)
    for (const area of muddy) {
      // Pad + contour wobble spill past the rect, so demand a 16px margin.
      const contained = CLEARINGS.some(
        (patch) => (patch.kind ?? 'dirt') === 'dirt' && contains(patch.rect, area.rect, 16),
      )
      expect(contained, `pond ${area.rect.x},${area.rect.y}`).toBe(true)
    }
  })

  it('digs transition demos for the other pairs too', () => {
    // A gravel heap inside a dirt clearing exercises the gravel ↔ dirt pair.
    const gravelInDirt = CLEARINGS.some(
      (patch) =>
        patch.kind === 'gravel' &&
        patch.outside === 'dirt' &&
        CLEARINGS.some((host) => (host.kind ?? 'dirt') === 'dirt' && contains(host.rect, patch.rect, 16)),
    )
    expect(gravelInDirt).toBe(true)
  })

  it('only uses previewable terrains for patches and ponds', () => {
    for (const patch of CLEARINGS) {
      if (patch.kind !== undefined) expect(PRIMARY_TERRAINS, 'patch kind').toContain(patch.kind)
      if (patch.outside !== undefined) expect(PRIMARY_TERRAINS, 'patch outside').toContain(patch.outside)
    }
    for (const area of WATER_AREAS) {
      if (area.outside !== undefined) expect(PRIMARY_TERRAINS, 'pond outside').toContain(area.outside)
    }
  })

  it('keeps elevation sane and demos at least one plateau', () => {
    const elevated = CLEARINGS.filter((patch) => (patch.elevation ?? 0) > 0)
    expect(elevated.length).toBeGreaterThan(0)
    for (const patch of CLEARINGS) {
      if (patch.elevation === undefined) continue
      expect(Number.isInteger(patch.elevation), 'elevation is a whole step').toBe(true)
      expect(patch.elevation).toBeGreaterThanOrEqual(1)
      expect(patch.elevation).toBeLessThanOrEqual(3)
    }
  })

  it('still leaves most of the map as open ground', () => {
    const area = zones.reduce((sum, zone) => sum + zone.rect.width * zone.rect.height, 0)
    expect(area / (WORLD_WIDTH * WORLD_HEIGHT)).toBeLessThan(0.6)
  })

  it('gives the ponds real size, not puddles', () => {
    const biggest = ponds.reduce((max, rect) => Math.max(max, rect.width * rect.height), 0)
    expect(biggest).toBeGreaterThan(12_000)
  })
})