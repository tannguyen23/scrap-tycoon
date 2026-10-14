import type { GameContent, ItemId, ZoneId } from './types'

/**
 * Which zone's warehouse holds each item: the zone of the first worker that
 * CONSUMES it (a transport leg draws from the bin standing in its own zone),
 * falling back to the zone of the first worker that produces it. The currency
 * never belongs to a zone — money stays in the global pool.
 *
 * This is the one place the item ↔ zone mapping is defined; `zoneStockItem`
 * (HUD/scene readouts) and the production pass both resolve through it.
 */
export function itemZoneMap(content: GameContent): Map<ItemId, ZoneId> {
  const map = new Map<ItemId, ZoneId>()
  const currency = content.currencyItemId

  for (const branch of Object.values(content.branches)) {
    for (const worker of branch.workers) {
      const item = worker.input?.item
      if (!item || item === currency || map.has(item)) continue
      map.set(item, worker.visual.zone)
    }
  }
  for (const branch of Object.values(content.branches)) {
    for (const worker of branch.workers) {
      const item = worker.output.item
      if (item === currency || map.has(item)) continue
      map.set(item, worker.visual.zone)
    }
  }
  return map
}

const cache = new WeakMap<GameContent, Map<ItemId, ZoneId>>()

/** `itemZoneMap` memoized per content object — ticks resolve this every step. */
export function itemZones(content: GameContent): Map<ItemId, ZoneId> {
  let map = cache.get(content)
  if (!map) {
    map = itemZoneMap(content)
    cache.set(content, map)
  }
  return map
}

/** Zone whose warehouse holds `itemId`, or null when the item is global. */
export function zoneOfItem(content: GameContent, itemId: ItemId): ZoneId | null {
  return itemZones(content).get(itemId) ?? null
}
