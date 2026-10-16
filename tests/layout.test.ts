import { describe, expect, it } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { COURIER_RUNS } from '@ui/scene/couriers'
import { PRIMARY_TERRAINS } from '@ground/packs/scrapYard/terrains'
import { paintWorldGrounds, SCATTER_SKIP_RECTS } from '@ground/packs/scrapYard/worldGrounds'
import type { TilePainter } from '@ground/core/painter'
import {
  AVENUE_HEIGHT,
  AVENUE_Y,
  CLEARINGS,
  CONNECTORS,
  WATER_AREAS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
  type ZoneRect,
} from '@ground/packs/scrapYard/worldLayout'

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

describe('lane dressing', () => {
  it('roughens every dirt lane and lays wear along them', () => {
    // A path is a place people work: its contour must wobble (or the edge-tile
    // row is uniform and the band reads as a pasted rectangle) and the map must
    // lay usage traces over it (a bare strip of tiles reads as flat).
    const calls: unknown[][] = []
    const painter = {
      setClip: () => {},
      paint: () => {},
      patchwork: () => {},
      scatter: () => {},
      paintBlob: () => {},
      paintPath: (...args: unknown[]) => {
        calls.push(args)
      },
    } as unknown as TilePainter
    const ground = new Container()
    paintWorldGrounds(painter, ground, new Graphics())

    const lanes = calls.filter((args) => args[2] === 'dirt')
    expect(lanes.length).toBeGreaterThanOrEqual(2)
    for (const args of lanes) {
      // jitter is the 9th argument of paintPath.
      expect(typeof args[8], `lane ${JSON.stringify(args[1])}`).toBe('number')
      expect(args[8] as number).toBeGreaterThan(0)
    }
    // The wear pass (worn line / footprints / wheel ruts) lands on the ground.
    expect(ground.children.length).toBeGreaterThan(0)
  })
})

describe('map layout', () => {
  it('is a genuinely big world, with the work core kept compact', () => {
    // The world is many times the old yard; the five chain zones stay a short walk
    // apart inside a compact core (the rest is wilderness to explore).
    expect(WORLD_WIDTH).toBeGreaterThanOrEqual(8192)
    expect(WORLD_HEIGHT).toBeGreaterThanOrEqual(4608)
    const minX = Math.min(...zones.map((zone) => zone.rect.x))
    const minY = Math.min(...zones.map((zone) => zone.rect.y))
    const maxX = Math.max(...zones.map((zone) => zone.rect.x + zone.rect.width))
    const maxY = Math.max(...zones.map((zone) => zone.rect.y + zone.rect.height))
    expect(maxX - minX).toBeLessThanOrEqual(3200)
    expect(maxY - minY).toBeLessThanOrEqual(1600)
  })

  it('runs the avenue the whole width, with the route zone on it', () => {
    const route = ZONE_LAYOUTS.route?.rect
    expect(route).toBeDefined()
    expect(route?.y).toBe(AVENUE_Y)
    expect(route?.height).toBe(AVENUE_HEIGHT)
    expect(route?.x).toBeGreaterThan(0)
    expect((route?.x ?? 0) + (route?.width ?? 0)).toBeLessThan(WORLD_WIDTH)
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

  it('keeps ponds out of the zones, off the connectors and off the avenue', () => {
    const avenue: ZoneRect = { x: 0, y: AVENUE_Y, width: WORLD_WIDTH, height: AVENUE_HEIGHT }
    for (const rect of ponds) {
      for (const { id, rect: zone } of zones) expect(overlaps(rect, zone), id).toBe(false)
      for (const connector of CONNECTORS) expect(overlaps(rect, connector)).toBe(false)
      expect(overlaps(rect, avenue), 'pond on the avenue').toBe(false)
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

  it('keeps raised plateaus clear of every courier walkway and yard', () => {
    // Blob + pad + the wall band spill ~40px past the rect; that influence must
    // never cover a courier path (characters would walk over a ledge) nor a zone
    // rect — the road band is a zone too, so it is exempt.
    for (const patch of CLEARINGS) {
      if (!(patch.elevation ?? 0)) continue
      const influence: ZoneRect = {
        x: patch.rect.x - 40,
        y: patch.rect.y - 40,
        width: patch.rect.width + 80,
        height: patch.rect.height + 80,
      }
      for (const { id, rect } of zones) {
        if (id === 'route') continue
        expect(overlaps(influence, rect), `raised patch ${patch.rect.x},${patch.rect.y} into ${id}`).toBe(false)
      }
      for (const connector of CONNECTORS) {
        expect(overlaps(influence, connector), `raised patch ${patch.rect.x},${patch.rect.y} over a connector`).toBe(false)
      }
      for (const [key, run] of Object.entries(COURIER_RUNS)) {
        for (let i = 0; i + 1 < run.path.length; i++) {
          const a = run.path[i]
          const b = run.path[i + 1]
          if (!a || !b) continue
          const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8)
          for (let step = 0; step <= steps; step++) {
            const t = steps === 0 ? 0 : step / steps
            const x = a.x + (b.x - a.x) * t
            const y = a.y + (b.y - a.y) * t
            const hits =
              x >= influence.x &&
              x <= influence.x + influence.width &&
              y >= influence.y &&
              y <= influence.y + influence.height
            expect(hits, `${key} crosses the raised patch at ${x},${y}`).toBe(false)
          }
        }
      }
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

  it('fences every yard and leaves the road open', () => {
    // `route` là đường chạy ngang map — rào lại là vô nghĩa.
    expect(ZONE_LAYOUTS.route?.fenceOpenings).toBeUndefined()
    for (const id of ['alley', 'recycle', 'depot', 'gate']) {
      expect(ZONE_LAYOUTS[id]?.fenceOpenings?.length, `${id} fence`).toBeGreaterThan(0)
    }
  })

  it('keeps every fence opening inside its edge', () => {
    for (const [id, layout] of Object.entries(ZONE_LAYOUTS)) {
      for (const opening of layout.fenceOpenings ?? []) {
        const span =
          opening.edge === 'north' || opening.edge === 'south'
            ? layout.rect.width
            : layout.rect.height
        expect(opening.from, `${id} ${opening.edge} from`).toBeGreaterThanOrEqual(0)
        expect(opening.to, `${id} ${opening.edge} to`).toBeLessThanOrEqual(span)
        expect(opening.from, `${id} ${opening.edge}`).toBeLessThan(opening.to)
      }
    }
  })

  it('clears the random ground scatter out of every zone', () => {
    // Lớp rải flora/debris phủ cả map; vùng cấm phải TRÙM trọn từng rect khu (kể cả
    // sát mép) — không thì hoa cỏ, sỏi rác lại mọc trong bãi.
    for (const { id, rect } of zones) {
      const covered = SCATTER_SKIP_RECTS.some(
        (skip) =>
          skip.x <= rect.x &&
          skip.y <= rect.y &&
          rect.x + rect.width <= skip.x + skip.width &&
          rect.y + rect.height <= skip.y + skip.height,
      )
      expect(covered, `${id}: vùng cấm rải random phải trùm kín khu`).toBe(true)
    }
  })

  it('opens each yard fence exactly where a lane crosses the edge', () => {
    // Lane/lối đi thật trên map: làn đất khu ve chai→đại lộ (worldGrounds), đường
    // đất ve chai→xưởng và các làn nhựa của `CONNECTORS`. `slack` = số px cho phép
    // mở rộng thêm mỗi phía.
    const cases = [
      { zone: 'alley', edge: 'south', lane: [4062, 4134], slack: 0 },
      { zone: 'alley', edge: 'east', lane: [2196, 2244], slack: 0 },
      { zone: 'recycle', edge: 'west', lane: [2196, 2244], slack: 0 },
      { zone: 'recycle', edge: 'south', lane: [5212, 5260], slack: 0 },
      { zone: 'depot', edge: 'north', lane: [4052, 4128], slack: 0 },
      { zone: 'gate', edge: 'north', lane: [6324, 6360], slack: 0 },
      { zone: 'gate', edge: 'east', lane: [3044, 3080], slack: 4 },
    ] as const
    for (const entry of cases) {
      const layout = ZONE_LAYOUTS[entry.zone]
      expect(layout, entry.zone).toBeDefined()
      const opening = layout?.fenceOpenings?.find((candidate) => candidate.edge === entry.edge)
      expect(opening, `${entry.zone} ${entry.edge}`).toBeDefined()
      const horizontal = entry.edge === 'north' || entry.edge === 'south'
      const base = horizontal ? (layout?.rect.x ?? 0) : (layout?.rect.y ?? 0)
      const from = base + (opening?.from ?? 0)
      const to = base + (opening?.to ?? 0)
      expect(from, `${entry.zone} ${entry.edge}: mở trước làn`).toBeLessThanOrEqual(entry.lane[0])
      expect(to, `${entry.zone} ${entry.edge}: mở hết làn`).toBeGreaterThanOrEqual(entry.lane[1])
      expect(entry.lane[0] - from + (to - entry.lane[1]), `${entry.zone} ${entry.edge}: cổng rộng vừa`).toBeLessThanOrEqual(
        entry.slack,
      )
    }
  })
})