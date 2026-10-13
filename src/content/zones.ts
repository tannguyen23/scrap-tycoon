import type { ZoneDef } from '@domain/types'

/**
 * Map zones for the scrap branch. Zone ids are shared between content (labels,
 * descriptions), the scene layout (ui/scene/zoneLayout.ts) and the HUD cards.
 */
export const ZONES: Record<string, ZoneDef> = {
  alley: {
    id: 'alley',
    name: { vi: 'Ngõ nhặt', en: 'Picking Alley' },
    actionDesc: {
      vi: 'Người nhặt ve chai đi bộ quanh bãi, lượm sắt vụn bỏ vào bao.',
      en: 'Scavengers walk around the yard, picking scrap into their bags.',
    },
  },
  route: {
    id: 'route',
    name: { vi: 'Tuyến ba gác', en: 'Cart Route' },
    actionDesc: {
      vi: 'Xe ba gác chạy vòng trên đường, gom bao chở về điểm thu mua.',
      en: 'Three-wheel carts loop the road, hauling sacks to the depot.',
    },
  },
  depot: {
    id: 'depot',
    name: { vi: 'Điểm thu mua', en: 'Buying Depot' },
    actionDesc: {
      vi: 'Cân hàng, bốc vác và xếp bao tải cao dần theo doanh thu.',
      en: 'Weighing, hauling and stacking sacks as revenue grows.',
    },
  },
  gate: {
    id: 'gate',
    name: { vi: 'Cổng xuất', en: 'City Gate' },
    actionDesc: {
      vi: 'Xe tải chở hàng ra rìa thành phố rồi quay về lấy chuyến mới.',
      en: 'Trucks haul goods out to the city edge, then return for another load.',
    },
  },
}
