import { stockRatio, zoneStockItem, zoneTiers } from '@domain/selectors'
import type { GameContent, GameState } from '@domain/types'
import { t, type Locale } from '@i18n/types'
import type { LooseFeed, SceneFeed, ZoneFeed } from '@scene/core/feed'
import { looseLocalPoint } from './loose'

/**
 * Turns the game's state into the plain readout the scene kit renders from. This
 * is the only place that knows both sides: the kit stays domain-free, and the
 * store stays out of the kit.
 */
export function buildSceneFeed(content: GameContent, state: GameState, locale: Locale): SceneFeed {
  const workers: Record<string, number> = {}
  const zoneWorkers: Record<string, number> = {}
  const zoneActions: Record<string, Record<string, number>> = {}
  const zoneItems: Record<string, string> = {}

  for (const branch of Object.values(content.branches)) {
    const branchState = state.branches[branch.id]
    if (!branchState) continue
    for (const worker of branch.workers) {
      const count = branchState.workers[worker.id] ?? 0
      if (count <= 0) continue
      workers[worker.id] = count
      const zone = worker.visual.zone
      zoneWorkers[zone] = (zoneWorkers[zone] ?? 0) + count
      const action = worker.visual.action
      const byAction = zoneActions[zone] ?? (zoneActions[zone] = {})
      byAction[action] = (byAction[action] ?? 0) + count
      if (zoneItems[zone] === undefined) zoneItems[zone] = worker.output.item
    }
  }

  const totalEarned = state.stats.totalEarned
  const earnedLog10 = totalEarned.gte(10) ? totalEarned.log10().toNumber() : 0
  const tiers = zoneTiers(content, state)

  // Popup wording: the item each zone produces + the currency, both localized.
  const moneyName = content.items[content.currencyItemId]?.name
  const moneyLabel = moneyName ? t(moneyName, locale) : content.currencyItemId
  const itemLabel = (itemId: string | undefined): string => {
    const name = itemId ? content.items[itemId]?.name : undefined
    return name ? t(name, locale) : moneyLabel
  }

  const zones: Record<string, ZoneFeed> = {}
  const looseByZone: Record<string, LooseFeed[]> = {}
  for (const piece of state.loose.items) {
    const list = looseByZone[piece.zone] ?? (looseByZone[piece.zone] = [])
    const point = looseLocalPoint(piece.zone, piece.id)
    list.push({ id: piece.id, item: piece.item, x: point.x, y: point.y })
  }
  for (const zoneId of Object.keys(content.zones)) {
    const stockItem = zoneStockItem(content, zoneId)
    const ratio = stockItem ? stockRatio(state, content, stockItem) : null
    zones[zoneId] = {
      workers: zoneWorkers[zoneId] ?? 0,
      actions: zoneActions[zoneId] ?? {},
      tier: tiers.get(zoneId) ?? 0,
      stock01: ratio ?? -1,
      labels: { produced: itemLabel(zoneItems[zoneId]), money: moneyLabel },
      loose: looseByZone[zoneId] ?? [],
    }
  }

  return { playTimeS: state.stats.playTimeS, earnedLog10, zones, workers }
}
