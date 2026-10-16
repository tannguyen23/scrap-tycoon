import type { ZoneDef } from '@domain/types'

const BRANCH_ID = 'scrap'

/**
 * Map zones for the scrap branch. Zone ids are shared between content (labels,
 * descriptions), the scene layout (ground/packs/scrapYard/worldLayout.ts) and the
 * HUD cards. Each zone is gated by the previous step of the chain: a step whose
 * input does not exist yet would be a dead purchase, so the yard opens the next
 * zone only once the step before it is staffed.
 */
export const ZONES: Record<string, ZoneDef> = {
  alley: {
    id: 'alley',
    name: { vi: 'Khu ve chai', en: 'Scrap Alley' },
    actionDesc: {
      vi: 'Người nhặt ve chai chọt lon, sắt vụn từ các đống rồi gom hết về một đống giữa bãi; nhân viên bốc vác vác bao ra cổng đông chở sang xưởng tái chế.',
      en: 'Scavengers poke cans and scrap out of the heaps and gather them into one pile; porters haul the sacks out the east gate to the forge.',
    },
  },
  recycle: {
    id: 'recycle',
    name: { vi: 'Xưởng tái chế', en: 'Recycling Forge' },
    actionDesc: {
      vi: 'Thợ rèn nấu và đập phế liệu trên đe thành phôi tái chế — búa gõ nhịp, hạt sắt tóe lửa.',
      en: 'Forge workers melt and hammer scrap on the anvil into recycled billets — steady clangs, flying sparks.',
    },
    // Thợ rèn chỉ có việc khi bao phế liệu đã được bốc vác ra khỏi bãi.
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'porter', count: 1 },
  },
  route: {
    id: 'route',
    name: { vi: 'Tuyến ba gác', en: 'Cart Route' },
    actionDesc: {
      vi: 'Xe ba gác chạy vòng trên đường, chở phôi từ xưởng xuống nơi đóng hàng.',
      en: 'Three-wheel carts loop the road, hauling billets from the forge down to the packing house.',
    },
    // Ba gác chở phôi — phải có phôi từ lò trước.
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'smelter', count: 1 },
  },
  depot: {
    id: 'depot',
    name: { vi: 'Nơi đóng hàng', en: 'Packing House' },
    actionDesc: {
      vi: 'Thợ đóng hàng gom pallet, bọc kiện và xếp cao dần chờ xe tải xuất.',
      en: 'Packers gather pallets, strap them into crates and stack them for the export trucks.',
    },
    // Đóng hàng cần pallet — tức là cần tuyến ba gác đang chạy.
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'cart', count: 1 },
  },
  gate: {
    id: 'gate',
    name: { vi: 'Cổng xuất', en: 'City Gate' },
    actionDesc: {
      vi: 'Xe tải xuất chở kiện hàng ra khỏi thành phố — đây là nơi tiền thật chảy về.',
      en: 'Export trucks haul crates out of the city — this is where the real money comes in.',
    },
    // Xuất hàng cần kiện đã đóng ở kho.
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'depot', count: 1 },
  },
}
