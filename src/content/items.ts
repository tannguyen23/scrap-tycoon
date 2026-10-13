import type { ItemDef } from '@domain/types'

export const MONEY_ITEM = 'money'
export const SCRAP_ITEM = 'scrap'

export const ITEMS: Record<string, ItemDef> = {
  [MONEY_ITEM]: {
    id: MONEY_ITEM,
    name: { vi: 'Tiền', en: 'Coins' },
  },
  [SCRAP_ITEM]: {
    id: SCRAP_ITEM,
    name: { vi: 'Sắt vụn', en: 'Scrap Metal' },
    unit: { vi: 'kg', en: 'kg' },
  },
}
