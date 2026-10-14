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
      vi: 'Người nhặt ve chai đi bộ quanh bãi, chọt lon và sắt vụn bỏ vào thùng; nhân viên bốc vác đóng bao chở sang xưởng.',
      en: 'Scavengers poke cans and scrap into the alley bin; porters bag it up and haul it to the forge.',
    },
  },
  recycle: {
    id: 'recycle',
    name: { vi: 'Xưởng tái chế', en: 'Recycling Forge' },
    actionDesc: {
      vi: 'Thợ rèn nấu và đập phế liệu trên đe thành phôi tái chế — búa gõ nhịp, hạt sắt tóe lửa.',
      en: 'Forge workers melt and hammer scrap on the anvil into recycled billets — steady clangs, flying sparks.',
    },
  },
  route: {
    id: 'route',
    name: { vi: 'Tuyến ba gác', en: 'Cart Route' },
    actionDesc: {
      vi: 'Xe ba gác chạy vòng trên đường, chở phôi từ xưởng xuống nơi đóng hàng.',
      en: 'Three-wheel carts loop the road, hauling billets from the forge down to the packing house.',
    },
  },
  depot: {
    id: 'depot',
    name: { vi: 'Nơi đóng hàng', en: 'Packing House' },
    actionDesc: {
      vi: 'Thợ đóng hàng gom pallet, bọc kiện và xếp cao dần chờ xe tải xuất.',
      en: 'Packers gather pallets, strap them into crates and stack them for the export trucks.',
    },
  },
  gate: {
    id: 'gate',
    name: { vi: 'Cổng xuất', en: 'City Gate' },
    actionDesc: {
      vi: 'Xe tải xuất chở kiện hàng ra khỏi thành phố — đây là nơi tiền thật chảy về.',
      en: 'Export trucks haul crates out of the city — this is where the real money comes in.',
    },
  },
}
