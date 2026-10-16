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
  tires: {
    id: 'tires',
    name: { vi: 'Bãi lốp', en: 'Tire Yard' },
    actionDesc: {
      vi: 'Lốp cũ xếp chồng và dựng tựa quanh thửa đất phía tây — chỗ để dành cho công việc tháo lốp sau này.',
      en: 'Old tyres stacked and leaning across the west plot — ground kept for tyre-stripping work later.',
    },
    // Chưa có thợ: khu này chờ gameplay. Mở sau khi bãi làm việc đã đông người.
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'scavenger', count: 5 },
  },
  appliances: {
    id: 'appliances',
    name: { vi: 'Bãi đồ trắng', en: 'Appliance Yard' },
    actionDesc: {
      vi: 'Tủ lạnh, máy giặt, TV hỏng xếp thành hàng phía bắc — chỗ để dành cho công việc tháo máy sau này.',
      en: 'Dead fridges, washers and TVs lined up along the north plot — ground kept for appliance stripping later.',
    },
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'porter', count: 2 },
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
