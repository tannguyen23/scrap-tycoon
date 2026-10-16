import { LOOSE_SPAWNS } from '@content/loose'
import { pointInPolygon } from '@ground/core/edgeGeometry'
import { ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import { ALLEY_PROPS } from '@ui/scene/focus/alley/scene'
import { propBase } from '@ui/scene/focus/props'
import { looseLocalPoint, looseSpots, looseWorldPoint } from '@ui/scene/loose'
import { buildBlockers, canStand, zoneAt } from '@ui/scene/player/walkable'
import { describe, expect, it } from 'vitest'

/**
 * Where debris lands. The user's rule is blunt: it appears ON THE GROUND but
 * INSIDE the yard — never outside the fence, never inside a prop — so a piece is
 * always something the player can walk to and pick up.
 *
 * Và từ khi có luật "sân chừa trống": món rời còn phải rơi vào SÂN TRỐNG mà scene
 * để dành (không prop/litter), vì mẩu sắt 4px chỉ đọc ra khi nó đứng một mình trên
 * sàn thoáng. Mấy test dưới đây khoá cả hai đầu của hợp đồng đó: điểm rải nằm trong
 * sân, và không thứ gì khác được chen vào sân.
 */
describe('loose debris placement', () => {
  const blockers = buildBlockers()
  const rect = ZONE_LAYOUTS.alley?.rect
  const bay = ZONE_LAYOUTS.alley?.looseBay

  it('keeps every alley spot inside the yard and on walkable ground', () => {
    expect(rect).toBeDefined()
    const spots = looseSpots('alley')
    expect(spots.length).toBeGreaterThanOrEqual(6)
    for (const spot of spots) {
      const x = (rect?.x ?? 0) + spot.x
      const y = (rect?.y ?? 0) + spot.y
      expect(zoneAt(x, y)).toBe('alley')
      expect(canStand(blockers, x, y, 3)).toBe(true)
    }
  })

  it('gives the same piece the same point every time, in the yard', () => {
    const local = looseLocalPoint('alley', 7)
    expect(looseLocalPoint('alley', 7)).toEqual(local)
    expect(looseWorldPoint('alley', 7)).toEqual({
      x: (rect?.x ?? 0) + local.x,
      y: (rect?.y ?? 0) + local.y,
    })
    // …and every id lands on a real spot inside the fence.
    for (let id = 1; id <= 24; id++) {
      const point = looseWorldPoint('alley', id)
      expect(zoneAt(point.x, point.y)).toBe('alley')
      expect(canStand(blockers, point.x, point.y, 3)).toBe(true)
    }
  })

  it('lays every spot inside the kept-clear bay, with room for the whole cap', () => {
    expect(bay, 'alley phải khai `looseBay` — sân chừa trống cho món rời').toBeDefined()
    if (!bay || !rect) throw new Error('fixture is missing the alley bay')
    const spots = looseSpots('alley')
    const cap = Math.max(...LOOSE_SPAWNS.map((def) => def.cap))
    // Nhiều điểm hơn cap: hai món sống cùng lúc không bao giờ chung một điểm.
    expect(spots.length).toBeGreaterThanOrEqual(cap + 2)
    const points = new Set(spots.map((spot) => `${spot.x},${spot.y}`))
    expect(points.size).toBe(spots.length)
    for (const spot of spots) {
      expect(spot.x, 'điểm rải lọt tây khỏi sân').toBeGreaterThanOrEqual(bay.x)
      expect(spot.y, 'điểm rải lọt bắc khỏi sân').toBeGreaterThanOrEqual(bay.y)
      expect(spot.x, 'điểm rải lọt đông khỏi sân').toBeLessThanOrEqual(bay.x + bay.width)
      expect(spot.y, 'điểm rải lọt nam khỏi sân').toBeLessThanOrEqual(bay.y + bay.height)
    }
  })

  it('keeps the bay empty: no prop stands inside it, and it clears the ring', () => {
    if (!bay || !rect) throw new Error('fixture is missing the alley bay')
    // 4px = đệm chân của hộp chặn (xem `walkable`): cạnh art lẫn bóng tiếp xúc đều phải
    // chừa, kẻo món rời hiện ra ngay dưới gầm thùng.
    const foot = 4
    for (const prop of ALLEY_PROPS) {
      const base = propBase(prop)
      const overlaps =
        base.x - foot < bay.x + bay.width &&
        base.x + base.width + foot > bay.x &&
        base.y - foot < bay.y + bay.height &&
        base.y + base.height + foot > bay.y
      expect(overlaps, `prop ${prop.kind} @${prop.x},${prop.y} đè lên sân chừa trống`).toBe(false)
    }
    // Sân phải nằm TRỌN trong thửa (kể cả phần khuyết góc của vành) và cách vành một
    // quãng đủ xa để mặt tiền rào không che món nằm sát mép.
    const outline = (ZONE_LAYOUTS.alley?.outline ?? []).flatMap((point) => [point.x, point.y])
    const corners = [
      { x: bay.x, y: bay.y },
      { x: bay.x + bay.width, y: bay.y },
      { x: bay.x, y: bay.y + bay.height },
      { x: bay.x + bay.width, y: bay.y + bay.height },
    ]
    for (const corner of corners) {
      expect(rect.x + corner.x, 'sân lọt ra ngoài rect khu (tây)').toBeGreaterThanOrEqual(rect.x + 24)
      expect(rect.y + corner.y, 'sân lọt ra ngoài rect khu (bắc)').toBeGreaterThanOrEqual(rect.y + 24)
      expect(rect.x + corner.x, 'sân lọt ra ngoài rect khu (đông)').toBeLessThanOrEqual(
        rect.x + rect.width - 24,
      )
      expect(rect.y + corner.y, 'sân lọt ra ngoài rect khu (nam)').toBeLessThanOrEqual(
        rect.y + rect.height - 24,
      )
      expect(
        pointInPolygon(corner.x, corner.y, outline),
        `góc sân ${corner.x},${corner.y} nằm ngoài vành thửa`,
      ).toBe(true)
    }
  })
})
