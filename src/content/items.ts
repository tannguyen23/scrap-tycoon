import type { ItemDef } from '@domain/types'
import { Decimal } from '@core/num'

export const MONEY_ITEM = 'money'
export const SCRAP_ITEM = 'scrap'
export const SACK_ITEM = 'sack'
export const BILLET_ITEM = 'billet'
export const PALLET_ITEM = 'pallet'
export const CRATE_ITEM = 'crate'

/**
 * `cap` = sức chứa KHO của khu: công đoạn sau chậm thì kho đầy và công đoạn trước
 * dừng lại — đây là cơ chế nghẽn của cả chuỗi. Nâng sức chứa bằng upgrade target
 * `item.<id>.capacity`.
 *
 * `carry` = sức chứa TÚI của người chơi cho loại hàng đó (nâng bằng
 * `item.<id>.carry`). Đây mới là thứ buộc phải đi bỏ hàng về kho: việc tay gom vào
 * túi, túi đầy thì đứng làm tiếp cũng vô ích. Tiền không có `carry` — tiền không
 * bao giờ nằm trong túi.
 */
export const ITEMS: Record<string, ItemDef> = {
  [MONEY_ITEM]: {
    id: MONEY_ITEM,
    name: { vi: 'Tiền', en: 'Coins' },
  },
  [SCRAP_ITEM]: {
    id: SCRAP_ITEM,
    name: { vi: 'Sắt vụn', en: 'Scrap Metal' },
    unit: { vi: 'kg', en: 'kg' },
    cap: new Decimal(80),
    carry: new Decimal(20),
  },
  [SACK_ITEM]: {
    id: SACK_ITEM,
    name: { vi: 'Bao phế liệu', en: 'Scrap Sacks' },
    unit: { vi: 'bao', en: 'sacks' },
    cap: new Decimal(30),
    carry: new Decimal(6),
  },
  [BILLET_ITEM]: {
    id: BILLET_ITEM,
    name: { vi: 'Phôi tái chế', en: 'Recycled Billets' },
    unit: { vi: 'cây', en: 'billets' },
    cap: new Decimal(30),
    carry: new Decimal(6),
  },
  [PALLET_ITEM]: {
    id: PALLET_ITEM,
    name: { vi: 'Pallet phôi', en: 'Billet Pallets' },
    unit: { vi: 'pallet', en: 'pallets' },
    cap: new Decimal(20),
    carry: new Decimal(4),
  },
  [CRATE_ITEM]: {
    id: CRATE_ITEM,
    name: { vi: 'Kiện hàng', en: 'Shipping Crates' },
    unit: { vi: 'kiện', en: 'crates' },
    cap: new Decimal(20),
    carry: new Decimal(4),
  },
}
