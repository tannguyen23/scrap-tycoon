import type { GameContent } from '@domain/types'
import { SCRAP_BRANCH } from './branches/scrap'
import { ITEMS, MONEY_ITEM } from './items'

/**
 * The game's content registry — injected into the domain at boot (and into the
 * UI through React context). Only `app` and tests import this module.
 */
export const GAME_CONTENT: GameContent = {
  currencyItemId: MONEY_ITEM,
  items: ITEMS,
  branches: {
    [SCRAP_BRANCH.id]: SCRAP_BRANCH,
  },
}
