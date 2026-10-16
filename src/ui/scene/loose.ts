import { ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import type { Spot } from '@scene/core/types'
import { buildBlockers, canStand, zoneAt, type Blockers } from './player/walkable'

/** How close the player must stand to a piece of debris to pick it up (world px). */
export const LOOSE_REACH = 26

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
 * A handful of walkable spots inside a zone, found once and reused by index.
 * Debris is placed at `spots[id % spots.length]`, so a piece keeps its point for
 * good and adding or removing others never shuffles the rest. Coordinates are
 * LOCAL to the zone — what the zone's detail scene draws in.
 */
export function looseSpots(zoneId: string): Spot[] {
  const cached = spotsCache.get(zoneId)
  if (cached) return cached
  const rect = ZONE_LAYOUTS[zoneId]?.rect
  const found: Spot[] = []
  if (rect) {
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
