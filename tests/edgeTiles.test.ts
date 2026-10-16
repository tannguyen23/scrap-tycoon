import { describe, expect, it } from 'vitest'
import {
  CONTOUR_AMP,
  CONTOUR_JITTER,
  EDGE_SHAPES,
  TILE_SIZE,
  blobContour,
  cliffBandEdges,
  clipPolygonToTile,
  cornerMask,
  cornerMaskAny,
  distanceToContour,
  pointInPolygon,
  polygonCentroid,
  rectContour,
  scaleAboutCentroid,
  trailContour,
} from '@ground/core/edgeGeometry'

const TILE = 16
/** The same scales `paintEdgeTile` fills with (AO wash → lip → rim → base). */
const FACTORS = [1, 1.06, 1.18, 1.3]

/** Shoelace area, absolute value. */
function polygonArea(points: readonly number[]): number {
  let sum = 0
  const count = points.length / 2
  for (let i = 0; i < count; i++) {
    const ax = points[i * 2] ?? 0
    const ay = points[i * 2 + 1] ?? 0
    const bx = points[((i + 1) % count) * 2] ?? 0
    const by = points[((i + 1) % count) * 2 + 1] ?? 0
    sum += ax * by - bx * ay
  }
  return Math.abs(sum) / 2
}

describe('edge tile contour geometry', () => {
  const cases = Object.entries(EDGE_SHAPES).map(([mask, shapes]) => ({ mask: Number(mask), shapes }))

  it('covers exactly the 14 mixed corner cases', () => {
    expect(cases.map((entry) => entry.mask).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ])
  })

  it('defines the raw shapes inside one tile', () => {
    for (const { mask, shapes } of cases) {
      for (const shape of shapes) {
        expect(shape.length, `mask ${mask}`).toBeGreaterThanOrEqual(6)
        for (const value of shape) {
          expect(value, `mask ${mask}`).toBeGreaterThanOrEqual(0)
          expect(value, `mask ${mask}`).toBeLessThanOrEqual(TILE)
        }
      }
    }
  })

  it('clips every scaled contour inside the tile (regression: smeared textures)', () => {
    for (const { mask, shapes } of cases) {
      for (const shape of shapes) {
        const centroid = polygonCentroid(shape)
        for (const factor of FACTORS) {
          const clipped = clipPolygonToTile(scaleAboutCentroid(shape, centroid, factor))
          expect(clipped.length, `mask ${mask} factor ${factor}`).toBeGreaterThanOrEqual(6)
          for (const value of clipped) {
            expect(value, `mask ${mask} factor ${factor}`).toBeGreaterThanOrEqual(-0.001)
            expect(value, `mask ${mask} factor ${factor}`).toBeLessThanOrEqual(TILE + 0.001)
          }
        }
      }
    }
  })

  it('keeps a visible area for the innermost fill', () => {
    for (const { mask, shapes } of cases) {
      for (const shape of shapes) {
        const centroid = polygonCentroid(shape)
        const base = clipPolygonToTile(scaleAboutCentroid(shape, centroid, 1))
        expect(polygonArea(base), `mask ${mask}`).toBeGreaterThan(4)
      }
    }
  })

  it('scales outward, never inward', () => {
    for (const { mask, shapes } of cases) {
      for (const shape of shapes) {
        const centroid = polygonCentroid(shape)
        const wide = clipPolygonToTile(scaleAboutCentroid(shape, centroid, 1.3))
        const base = clipPolygonToTile(scaleAboutCentroid(shape, centroid, 1))
        expect(polygonArea(wide), `mask ${mask}`).toBeGreaterThan(polygonArea(base))
      }
    }
  })
})

describe('clearing contour masks', () => {
  const rect = { x: 100, y: 100, width: 200, height: 120 }
  const pad = 20
  const seed = 7
  const contour = blobContour(rect, pad, seed)
  /** `blobContour` normalises the outline wave to `CONTOUR_AMP` + ±4px roughening. */
  const WOBBLE = 1 + CONTOUR_AMP
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const rx = (rect.width / 2 + pad) * WOBBLE + CONTOUR_JITTER
  const ry = (rect.height / 2 + pad) * WOBBLE + CONTOUR_JITTER

  it('keeps the contour on its wobbled ellipse', () => {
    for (let i = 0; i < contour.length; i += 2) {
      expect(contour[i]).toBeGreaterThanOrEqual(cx - rx - 1)
      expect(contour[i]).toBeLessThanOrEqual(cx + rx + 1)
      expect(contour[i + 1]).toBeGreaterThanOrEqual(cy - ry - 1)
      expect(contour[i + 1]).toBeLessThanOrEqual(cy + ry + 1)
    }
  })

  it('stays inside the band the painter iterates (pad + one tile)', () => {
    for (let i = 0; i < contour.length; i += 2) {
      expect(contour[i]).toBeLessThanOrEqual(rect.x + rect.width + pad + TILE_SIZE)
      expect(contour[i]).toBeGreaterThanOrEqual(rect.x - pad - TILE_SIZE)
      expect(contour[i + 1]).toBeLessThanOrEqual(rect.y + rect.height + pad + TILE_SIZE)
      expect(contour[i + 1]).toBeGreaterThanOrEqual(rect.y - pad - TILE_SIZE)
    }
  })

  it('marks tiles well inside the clearing as full (mask 15)', () => {
    expect(cornerMask(rect.x + 48, rect.y + 32, contour, seed)).toBe(15)
    expect(cornerMask(rect.x + 96, rect.y + 56, contour, seed)).toBe(15)
  })

  it('never marks tiles far outside the clearing (regression: smear bands)', () => {
    for (let x = rect.x + rect.width + pad + 32; x < rect.x + rect.width + 400; x += 16) {
      for (let y = rect.y - 80; y < rect.y + rect.height + 80; y += 16) {
        expect(cornerMask(x, y, contour, seed), `tile ${x},${y}`).toBe(0)
      }
    }
    for (let y = rect.y - pad - 32; y > rect.y - 240; y -= 16) {
      for (let x = rect.x - 80; x < rect.x + rect.width + 80; x += 16) {
        expect(cornerMask(x, y, contour, seed), `tile ${x},${y}`).toBe(0)
      }
    }
  })

  it('gives every tile on the contour band a mixed mask', () => {
    let mixed = 0
    for (let x = rect.x - pad - 16; x < rect.x + rect.width + pad + 16; x += 16) {
      for (let y = rect.y - pad - 16; y < rect.y + rect.height + pad + 16; y += 16) {
        const mask = cornerMask(x, y, contour, seed)
        expect(mask).toBeGreaterThanOrEqual(0)
        expect(mask).toBeLessThanOrEqual(15)
        if (mask !== 0 && mask !== 15) mixed++
      }
    }
    expect(mixed).toBeGreaterThan(8)
  })

  it('keeps a real curve: no long straight run along a wide edge', () => {
    // A zone-floor shaped rect. The old 16-gon left a ~200px straight side here;
    // a smooth curve never runs flat for more than a small stretch.
    const points = blobContour({ x: 80, y: 560, width: 264, height: 88 }, 24, 13)
    const count = points.length / 2
    let runSpan = 0
    let longestSpan = 0
    for (let i = 1; i < count; i++) {
      const dx = Math.abs((points[i * 2] ?? 0) - (points[(i - 1) * 2] ?? 0))
      const dy = Math.abs((points[i * 2 + 1] ?? 0) - (points[(i - 1) * 2 + 1] ?? 0))
      // A "horizontal run" is a step that barely moves in y.
      if (dy <= 1) runSpan += dx
      else {
        longestSpan = Math.max(longestSpan, runSpan)
        runSpan = 0
      }
    }
    expect(Math.max(longestSpan, runSpan)).toBeLessThan(80)
  })

  it('reads as an amorphous clearing, not an ellipse', () => {
    // Radial deviation from the plain ellipse, in px: + outside, - inside.
    const rect = { x: 0, y: 0, width: 224, height: 124 }
    const pad = 24
    const points = blobContour(rect, pad, 4)
    const count = points.length / 2
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    const rx = rect.width / 2 + pad
    const ry = rect.height / 2 + pad
    const deviations: number[] = []
    for (let i = 0; i < count; i++) {
      const x = points[i * 2] ?? 0
      const y = points[i * 2 + 1] ?? 0
      const ellipse = Math.hypot((x - cx) / rx, (y - cy) / ry)
      deviations.push((ellipse - 1) * ((rx + ry) / 2))
    }

    // Jagged: the outline swells and indents over and over (15–30 extrema across
    // seeds 1–12), so the tile grid cuts a rough, uneven border.
    let extrema = 0
    for (let i = 0; i < count; i++) {
      const before = deviations[(i - 1 + count) % count] ?? 0
      const here = deviations[i] ?? 0
      const after = deviations[(i + 1) % count] ?? 0
      if ((here - before > 1 && here - after > 1) || (before - here > 1 && after - here > 1)) extrema++
    }
    expect(extrema).toBeGreaterThanOrEqual(12)

    // Amorphous: the irregularity survives blurring, i.e. it is in the shape itself
    // and not just per-sample noise. A near-ellipse would flatten to ~0 here.
    let smoothedPeak = 0
    for (let i = 0; i < count; i++) {
      let sum = 0
      for (let k = -3; k <= 3; k++) sum += deviations[(i + k + count) % count] ?? 0
      smoothedPeak = Math.max(smoothedPeak, Math.abs(sum / 7))
    }
    expect(smoothedPeak).toBeGreaterThan(4)

    // No bulging: wave + roughening stay under ~a tile and a half, so the steps
    // stay one-to-two tiles deep instead of turning into big blocks.
    expect(Math.max(...deviations.map(Math.abs))).toBeLessThan(TILE * 1.4)
  })

  it('keeps a path constant-width in the middle and flared at both mouths', () => {
    // A band must never narrow: that is what pinched the link between areas. The
    // flare widens the two ends so the path merges into them like a trumpet.
    const rect = { x: 210, y: 168, width: 48, height: 300 }
    const points = rectContour(rect, 22)
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < points.length; i += 2) {
      xs.push(points[i] ?? 0)
      ys.push(points[i + 1] ?? 0)
    }
    expect(points.length).toBe(16)
    // Middle stretch: the two long sides sit exactly on the rect.
    expect(Math.min(...ys)).toBe(rect.y)
    expect(Math.max(...ys)).toBe(rect.y + rect.height)
    expect(xs.filter((x) => x === rect.x).length).toBeGreaterThanOrEqual(2)
    expect(xs.filter((x) => x === rect.x + rect.width).length).toBeGreaterThanOrEqual(2)
    // Both mouths are wider by the flare, never narrower.
    expect(Math.min(...xs)).toBe(rect.x - 22)
    expect(Math.max(...xs)).toBe(rect.x + rect.width + 22)
  })

  it('fades a flared mouth back to the band width over the ramp length', () => {
    // The junction funnel: a long ramp is the gradual opening, a short flare is a
    // chamfer. The band itself keeps its width in both cases.
    const rect = { x: 210, y: 150, width: 48, height: 318 }
    const points = rectContour(rect, 44, 76)
    // Ramp corners sit `ramp` px in from each mouth, on the rect edges.
    expect(points).toContain(rect.y + 76)
    expect(points).toContain(rect.y + rect.height - 76)
    expect(Math.min(...points.filter((_, index) => index % 2 === 0).map((x) => x))).toBe(rect.x - 44)
    expect(Math.max(...points.filter((_, index) => index % 2 === 0).map((x) => x))).toBe(
      rect.x + rect.width + 44,
    )
    // A ramp longer than half the band would fold it inside out.
    const clamped = rectContour({ x: 0, y: 0, width: 48, height: 60 }, 20, 400)
    const ys = clamped.filter((_, index) => index % 2 === 1)
    expect(Math.min(...ys)).toBe(0)
    expect(Math.max(...ys)).toBe(60)
  })

  it('flares only the mouth that opens into an area', () => {
    // A funnel on the end that meets a road would be a visible trapezoid, so the
    // path widens at the clearing end only.
    const rect = { x: 206, y: 150, width: 72, height: 214 }
    const points = rectContour(rect, 44, 50, 'top')
    const xs = points.filter((_, index) => index % 2 === 0)
    const ys = points.filter((_, index) => index % 2 === 1)
    expect(Math.min(...xs)).toBe(rect.x - 44)
    // The bottom corners stay exactly on the band.
    expect(ys.filter((y) => y === rect.y + rect.height).length).toBe(2)
    expect(xs.filter((x) => x === rect.x).length).toBeGreaterThanOrEqual(2)
    expect(xs.filter((x) => x === rect.x + rect.width).length).toBeGreaterThanOrEqual(2)
  })

  it('roughens a band side at the tile scale while pinning its ends and mouths', () => {
    // Dead-straight sides can never flip a tile mask (the corner sampler is ±3px,
    // under half a tile), so the band renders as a ruler line with a uniform edge
    // row — the "pasted rectangle" read. The wobble has to move the side by a few
    // px at the tile scale for whole tiles to step in and out.
    const rect = { x: 384, y: 100, width: 224, height: 48 }
    const points = rectContour(rect, 0, 0, 'both', 5)

    expect(points[0]).toBe(rect.x)
    expect(points[1]).toBe(rect.y)
    expect(points[points.length - 2]).toBe(rect.x)
    expect(points[points.length - 1]).toBe(rect.y + rect.height)

    const ys = points.filter((_, index) => index % 2 === 1)
    const top = ys.filter((y) => y <= rect.y + rect.height / 2).map((y) => y - rect.y)
    const bottom = ys.filter((y) => y > rect.y + rect.height / 2).map((y) => y - (rect.y + rect.height))
    // Wobbles both ways along the run, never a whole tile.
    expect(top.some((d) => d < -1.5)).toBe(true)
    expect(top.some((d) => d > 1.5)).toBe(true)
    expect(Math.max(...top.map(Math.abs))).toBeLessThanOrEqual(5)
    expect(Math.max(...bottom.map(Math.abs))).toBeLessThanOrEqual(5)

    // End corners stay exact for every jitter, and 0 keeps the plain rectangle.
    expect(rectContour(rect).length).toBe(8)
    expect(rectContour(rect, 0, 0, 'both', 0).length).toBe(8)

    // The point of the wobble: over the middle stretch the top tile row must
    // resolve to more than one mask. A dead-straight edge gives one uniform row
    // (only the two end columns jitter, from the corner sampler).
    const plain = rectContour(rect, 0, 0, 'both', 0)
    const flat = new Set<number>()
    const rough = new Set<number>()
    for (let x = rect.x + TILE_SIZE; x < rect.x + rect.width - TILE_SIZE; x += TILE_SIZE) {
      flat.add(cornerMask(x, rect.y - 4, plain, 17))
      rough.add(cornerMask(x, rect.y - 4, points, 17))
    }
    expect(flat.size).toBe(1)
    expect(rough.size).toBeGreaterThan(1)
  })

  it('wobbles a flared vertical band on its sides, never across a mouth', () => {
    // The alley→road lane: sides run vertically, mouths sit at the yard and at the
    // road. A wobble across a mouth would leave a grass sliver on the asphalt.
    const rect = { x: 206, y: 150, width: 72, height: 230 }
    const points = rectContour(rect, 44, 50, 'top', 5)
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < points.length; i += 2) {
      xs.push(points[i] ?? 0)
      ys.push(points[i + 1] ?? 0)
    }
    // The band's own side columns wobble (up to 5px), the flared mouth does not.
    const sideA = xs.filter((x) => Math.abs(x - rect.x) <= 5)
    const sideB = xs.filter((x) => Math.abs(x - (rect.x + rect.width)) <= 5)
    expect(sideA.some((x) => Math.abs(x - rect.x) > 1.5)).toBe(true)
    expect(sideB.some((x) => Math.abs(x - (rect.x + rect.width)) > 1.5)).toBe(true)
    // Mouth corners keep the exact flare width.
    expect(Math.min(...xs)).toBe(rect.x - 44)
    expect(Math.max(...xs)).toBe(rect.x + rect.width + 44)
  })

  it('selects a transition tile for every tile the contour crosses', () => {
    // Proof that the connect is actually used: any tile whose inner corners
    // straddle the contour must resolve to a mixed mask (1..14), never 0 or 15.
    const rect = { x: 40, y: 40, width: 200, height: 120 }
    const contour = blobContour(rect, 0, 5)
    let crossings = 0
    for (let x = rect.x - TILE_SIZE; x <= rect.x + rect.width; x += TILE_SIZE) {
      for (let y = rect.y - TILE_SIZE; y <= rect.y + rect.height; y += TILE_SIZE) {
        const corners = [
          pointInPolygon(x + 4, y + 4, contour),
          pointInPolygon(x + 12, y + 4, contour),
          pointInPolygon(x + 4, y + 12, contour),
          pointInPolygon(x + 12, y + 12, contour),
        ]
        const inside = corners.filter(Boolean).length
        if (inside === 0 || inside === 4) continue
        crossings++
        const mask = cornerMask(x, y, contour, 5)
        expect(mask, `tile ${x},${y}`).toBeGreaterThan(0)
        expect(mask, `tile ${x},${y}`).toBeLessThan(15)
      }
    }
    expect(crossings).toBeGreaterThan(4)
  })
})

describe('cliff bands (plateau walls)', () => {
  const square = [0, 0, 16, 0, 16, 16, 0, 16]

  it('puts a full wall on south edges, a thin one on east, none on north/west', () => {
    const bands = cliffBandEdges(square)
    const south = bands.find((band) => band.y1 === 16 && band.y2 === 16)
    const east = bands.find((band) => band.x1 === 16 && band.x2 === 16)
    expect(south?.depth).toBe(6)
    expect(east?.depth).toBe(4)
    // North edge (y = 0) and west edge (x = 0) must not produce a wall.
    expect(bands.some((band) => band.y1 === 0 && band.y2 === 0)).toBe(false)
    expect(bands.some((band) => band.x1 === 0 && band.x2 === 0)).toBe(false)
  })

  it('finds a wall on the south-facing edge of a lone-corner case', () => {
    const shapes = EDGE_SHAPES[3]
    const shape = shapes?.[0]
    expect(shape).toBeDefined()
    const bands = cliffBandEdges(shape ?? [])
    // The wavy bottom of the "top row inside" case faces the camera.
    expect(bands.some((band) => band.y1 >= 6 && band.y2 >= 6)).toBe(true)
  })

  it('measures distance to the contour', () => {
    expect(distanceToContour(square, 8, 8)).toBeGreaterThan(0)
    expect(distanceToContour(square, 8, 15)).toBeCloseTo(1, 5)
    expect(distanceToContour(square, 8, 25)).toBeCloseTo(9, 5)
  })
})

/** Width of a trail band at every sample: |left[i] → right[i]|, both edges of the contour. */
function trailWidths(contour: readonly number[]): number[] {
  const count = contour.length / 2 / 2
  const widths: number[] = []
  for (let i = 0; i < count; i++) {
    const lx = contour[i * 2] ?? 0
    const ly = contour[i * 2 + 1] ?? 0
    const back = (count - 1 - i) * 2
    const rx = contour[count * 2 + back] ?? 0
    const ry = contour[count * 2 + back + 1] ?? 0
    widths.push(Math.hypot(lx - rx, ly - ry))
  }
  expect(widths.length).toBeGreaterThan(10)
  return widths
}

describe('contour networks', () => {
  it('reads the union, so a fork has no internal edge to draw', () => {
    // Hai contour chồng nhau (tim trục + tim nhánh của một ngã ba). Xét một ô nằm vắt
    // qua ranh giới của cả hai: đọc TỪNG contour thì mỗi cái chỉ thấy nửa ô — đó chính
    // là "mép" mà lượt vẽ chuyển tiếp bám vào, thành vệt cỏ cắt ngang mối nối.
    const trunk = [-6, -6, 12, -6, 12, 24, -6, 24]
    const branch = [4, -6, 28, -6, 28, 24, 4, 24]
    const seed = 5
    expect(cornerMask(0, 0, trunk, seed)).toBe(1 | 8)
    expect(cornerMask(0, 0, branch, seed)).toBe(2 | 4)
    // Đọc theo MẠNG thì cả ô nằm trong HỢP ⇒ không còn mép nào để vẽ chuyển tiếp.
    expect(cornerMaskAny(0, 0, [trunk, branch], seed)).toBe(15)
    // Ô nằm ngoài cả hai vẫn là ngoài.
    expect(cornerMaskAny(200, 200, [trunk, branch], seed)).toBe(0)
  })
})

describe('trail contours', () => {
  // Một đường cong qua ba điểm gãy: chỗ gãy chính là thứ dễ ra "góc vuông".
  const path = [
    { x: 100, y: 320 },
    { x: 210, y: 250 },
    { x: 330, y: 262 },
    { x: 430, y: 210 },
  ]
  const HALF = 17

  it('follows the centreline, so the band covers the path it was given', () => {
    const contour = trailContour(path, HALF, 60)
    expect(contour.length).toBeGreaterThan(40)
    const samples: { x: number; y: number }[] = []
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i]
      const b = path[i + 1]
      if (!a || !b) continue
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4)
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      }
    }
    // Bỏ vài mẫu sát hai đầu: đầu dải thon lại nên đúng điểm cuối nằm TRÊN mép contour.
    for (const point of samples.slice(3, -3)) {
      expect(pointInPolygon(point.x, point.y, contour), `tim đường hở ở ${point.x},${point.y}`).toBe(true)
    }
  })

  it('tapers both ends instead of stopping on a square edge', () => {
    const widths = trailWidths(trailContour(path, HALF, 60))
    const middle = widths[Math.floor(widths.length / 2)] ?? 0
    // Giữa dải quanh cỡ khai báo (hai mép wobble độc lập nên không bao giờ bằng đúng).
    expect(middle).toBeGreaterThan(HALF * 2 * 0.8)
    expect(middle).toBeLessThan(HALF * 2 * 1.2)
    // Hai đầu thon lại — đầu dải cắt phẳng đọc ra hình chữ nhật.
    const first = widths[0] ?? 0
    const last = widths[widths.length - 1] ?? 0
    expect(first).toBeLessThan(middle * 0.8)
    expect(last).toBeLessThan(middle * 0.8)
  })

  it('wobbles, and wobbles the same way every time', () => {
    const widths = trailWidths(trailContour(path, HALF, 60))
    const spread = Math.max(...widths) - Math.min(...widths)
    expect(spread, 'bề ngang phải lay, không thì ra dải băng dán').toBeGreaterThan(HALF * 0.15)
    // Khoá theo vị trí: cùng đường, cùng seed ⇒ cùng dải (chunk nào vẽ cũng vậy).
    expect(trailContour(path, HALF, 60)).toEqual(trailContour(path, HALF, 60))
    expect(trailContour(path, HALF, 61)).not.toEqual(trailContour(path, HALF, 60))
  })
})
