import { ZONE_LAYOUTS, type ZoneRect } from '@ground/packs/scrapYard/worldLayout'
import type { Spot } from '@scene/core/types'
import { buildBlockers, canStand, zoneAt, type Blockers } from './player/walkable'

/** How close the player must stand to a piece of debris to pick it up (world px). */
export const LOOSE_REACH = 26

/**
 * Số điểm rải trong sân chừa trống — phải nhiều hơn `cap` của mọi `LooseSpawnDef`
 * (12) thì hai món sống cùng lúc mới không bao giờ chung một điểm.
 */
const BAY_SPOTS = 18
/** Lề trong sân: mép sân vẫn là chỗ art prop/vành kề bên — món phải đứng hẳn vào trong. */
const BAY_MARGIN = 5
/** Jitter mỗi điểm so với tâm ô lưới, px — đủ để không đọc ra "bàn cờ". */
const BAY_JITTER = 2

/** Spots are found once per zone and reused, so a per-frame reach check stays cheap. */
const spotsCache = new Map<string, Spot[]>()
let blockers: Blockers | null = null

function blockersOnce(): Blockers {
  return (blockers ??= buildBlockers())
}

/** Deterministic integer hash — the same piece id always lands on the same point. */
function mix(a: number, b: number): number {
  let h = (a * 0x27d4eb2d + b * 0x165667b1) | 0
  h = (h ^ (h >>> 15)) * 0x2c1b3c6d
  h = (h ^ (h >>> 12)) * 0x297a2d39
  return (h ^ (h >>> 15)) >>> 0
}

function unit(value: number): number {
  return value / 4294967296
}

/**
 * Điểm rải trong SÂN CHỪA TRỐNG của khu (`looseBay`): lưới ô đều + jitter theo hash,
 * nên sân luôn cho đủ điểm rải rác thay vì phụ thuộc số điểm mà vòng random tìm được.
 * Sân là chỗ scene CỐ Ý để trống (không prop nào đứng, lớp vụn nền bỏ qua) — có thế thì
 * mẩu sắt 4px mới là thứ duy nhất trên sàn và mắt mới bắt được nó.
 */
function baySpots(zoneId: string, rect: ZoneRect, bay: ZoneRect): Spot[] {
  const width = Math.max(1, bay.width - BAY_MARGIN * 2)
  const height = Math.max(1, bay.height - BAY_MARGIN * 2)
  const cols = Math.max(1, Math.round(Math.sqrt((BAY_SPOTS * width) / height)))
  const rows = Math.max(1, Math.ceil(BAY_SPOTS / cols))
  const cellWidth = width / cols
  const cellHeight = height / rows
  const blockersNow = blockersOnce()
  const found: Spot[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const seed = col * 131 + row * 977
      const x = Math.round(
        bay.x + BAY_MARGIN + (col + 0.5) * cellWidth + (unit(mix(seed, 1)) * 2 - 1) * BAY_JITTER,
      )
      const y = Math.round(
        bay.y + BAY_MARGIN + (row + 0.5) * cellHeight + (unit(mix(seed, 2)) * 2 - 1) * BAY_JITTER,
      )
      if (zoneAt(rect.x + x, rect.y + y) !== zoneId) continue
      if (!canStand(blockersNow, rect.x + x, rect.y + y, 3)) continue
      found.push({ x, y })
    }
  }
  // Xáo thứ tự bằng hash: món mới (id tăng dần, 1.5s một món) rơi rải rác quanh sân
  // thay vì mọc lần lượt theo hàng ô — vẫn tất định, cùng id vẫn cùng điểm.
  for (let i = found.length - 1; i > 0; i--) {
    const j = mix(i, 7) % (i + 1)
    const a = found[i]
    const b = found[j]
    if (a && b) {
      found[i] = b
      found[j] = a
    }
  }
  return found
}

/**
 * A handful of walkable spots inside a zone, found once and reused by index.
 * Debris is placed at `spots[id % spots.length]`, so a piece keeps its point for
 * good and adding or removing others never shuffles the rest. Coordinates are
 * LOCAL to the zone — what the zone's detail scene draws in.
 */
export function looseSpots(zoneId: string): Spot[] {
  const cached = spotsCache.get(zoneId)
  if (cached) return cached
  const layout = ZONE_LAYOUTS[zoneId]
  const rect = layout?.rect
  const found: Spot[] = []
  if (rect) {
    const bay = layout?.looseBay
    if (bay) {
      found.push(...baySpots(zoneId, rect, bay))
    } else {
      const margin = 24
      const minGap = 22
      const blockersNow = blockersOnce()
      for (let attempt = 0; attempt < 1500 && found.length < 32; attempt++) {
        const localX = margin + unit(mix(attempt, 1)) * Math.max(1, rect.width - margin * 2)
        const localY = margin + unit(mix(attempt, 2)) * Math.max(1, rect.height - margin * 2)
        if (zoneAt(rect.x + localX, rect.y + localY) !== zoneId) continue
        if (!canStand(blockersNow, rect.x + localX, rect.y + localY, 3)) continue
        if (found.some((spot) => Math.hypot(spot.x - localX, spot.y - localY) < minGap)) continue
        found.push({ x: localX, y: localY })
      }
    }
  }
  if (found.length === 0) found.push({ x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 })
  spotsCache.set(zoneId, found)
  return found
}

/** Where a piece of debris lies, LOCAL to its zone (the detail scene draws with it). */
export function looseLocalPoint(zoneId: string, id: number): Spot {
  const spots = looseSpots(zoneId)
  const index = ((id % spots.length) + spots.length) % spots.length
  return spots[index] ?? { x: 0, y: 0 }
}

/** Where a piece of debris lies in WORLD space (the reach check measures from here). */
export function looseWorldPoint(zoneId: string, id: number): Spot {
  const local = looseLocalPoint(zoneId, id)
  const rect = ZONE_LAYOUTS[zoneId]?.rect
  return { x: (rect?.x ?? 0) + local.x, y: (rect?.y ?? 0) + local.y }
}
