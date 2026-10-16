import type { GameContent } from '@domain/types'
import { MANUAL_ACTIONS } from './actions'
import { BALANCE } from './balance'
import { SCRAP_BRANCH } from './branches/scrap'
import { GEAR } from './gear'
import { ITEMS, MONEY_ITEM } from './items'
import { MILESTONES } from './milestones'
import { WEATHER } from './weather'
import { ZONES } from './zones'

/**
 * The game's content registry — injected into the domain at boot (and into the
 * UI through React context). Only `app` and tests import this module.
 */
export const GAME_CONTENT: GameContent = {
  currencyItemId: MONEY_ITEM,
  items: ITEMS,
  zones: ZONES,
  branches: {
    [SCRAP_BRANCH.id]: SCRAP_BRANCH,
  },
  milestones: MILESTONES,
  actions: MANUAL_ACTIONS,
  gear: GEAR,
  weather: WEATHER,
  simulation: { offlineChunkSeconds: BALANCE.offlineChunkSeconds },
}
