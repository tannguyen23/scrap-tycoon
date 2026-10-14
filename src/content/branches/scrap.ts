import { Decimal } from '@core/num'
import { branchRecipeOutput, branchWorkerOutput, itemCapacity } from '@domain/statKeys'
import type { BranchDef } from '@domain/types'
import { BILLET_ITEM, CRATE_ITEM, MONEY_ITEM, PALLET_ITEM, SACK_ITEM, SCRAP_ITEM } from '../items'

const BRANCH_ID = 'scrap'
const COST_GROWTH = new Decimal('1.15')

/**
 * Chuỗi logistics 6 công đoạn: nhặt → bốc vác → rèn → ba gác → đóng hàng → xuất.
 * Mỗi chặng có một đơn vị `input → output` riêng, kho có sức chứa nên chặng sau
 * chậm là chặng trước nghẽn. Ngoài ra mỗi chặng có **kênh bán lẻ phần dư**
 * (`recipes`) giá rẻ, throughput giới hạn: nhờ nó người chơi luôn có thu nhập để
 * xây tiếp, còn tiền lớn vẫn nằm ở hợp đồng xuất khẩu của xe tải (giá tốt hơn).
 * Pass vận chuyển chạy TRƯỚC recipe nên chặng sau luôn được ưu tiên lấy hàng —
 * recipe chỉ vớt phần dư.
 */
export const SCRAP_BRANCH: BranchDef = {
  id: BRANCH_ID,
  name: { vi: 'Đồng nát', en: 'Scrap Collecting' },
  workers: [
    {
      id: 'scavenger',
      name: { vi: 'Người nhặt ve chai', en: 'Scavenger' },
      baseCost: new Decimal(10),
      costGrowth: COST_GROWTH,
      output: { item: SCRAP_ITEM, ratePerUnit: new Decimal(1) },
      visual: { zone: 'alley', action: 'pick' },
    },
    {
      id: 'porter',
      name: { vi: 'Nhân viên bốc vác', en: 'Porter' },
      baseCost: new Decimal(30),
      costGrowth: COST_GROWTH,
      input: { item: SCRAP_ITEM, ratePerUnit: new Decimal(3) },
      output: { item: SACK_ITEM, ratePerUnit: new Decimal(3) },
      visual: { zone: 'alley', action: 'haul' },
    },
    {
      id: 'smelter',
      name: { vi: 'Thợ lò tái chế', en: 'Forge Worker' },
      baseCost: new Decimal(150),
      costGrowth: COST_GROWTH,
      input: { item: SACK_ITEM, ratePerUnit: new Decimal(2) },
      output: { item: BILLET_ITEM, ratePerUnit: new Decimal(2) },
      visual: { zone: 'recycle', action: 'work' },
    },
    {
      id: 'cart',
      name: { vi: 'Xe ba gác', en: 'Three-wheel Cart' },
      baseCost: new Decimal(700),
      costGrowth: COST_GROWTH,
      input: { item: BILLET_ITEM, ratePerUnit: new Decimal('2.5') },
      output: { item: PALLET_ITEM, ratePerUnit: new Decimal('2.5') },
      visual: { zone: 'route', action: 'drive' },
    },
    {
      id: 'depot',
      name: { vi: 'Thợ đóng hàng', en: 'Packer' },
      baseCost: new Decimal(3000),
      costGrowth: COST_GROWTH,
      input: { item: PALLET_ITEM, ratePerUnit: new Decimal(3) },
      output: { item: CRATE_ITEM, ratePerUnit: new Decimal(3) },
      visual: { zone: 'depot', action: 'work' },
    },
    {
      id: 'truck',
      name: { vi: 'Xe tải xuất', en: 'Export Truck' },
      baseCost: new Decimal(12000),
      costGrowth: COST_GROWTH,
      input: { item: CRATE_ITEM, ratePerUnit: new Decimal(1) },
      output: { item: MONEY_ITEM, ratePerUnit: new Decimal(220) },
      visual: { zone: 'gate', action: 'haul' },
    },
  ],
  recipes: [
    {
      id: 'peddle-scrap',
      name: { vi: 'Bán vụn rong', en: 'Peddle scrap' },
      input: { item: SCRAP_ITEM, rate: new Decimal(1) },
      output: { item: MONEY_ITEM, perInputUnit: new Decimal(2) },
    },
    {
      id: 'peddle-sack',
      name: { vi: 'Bán bao lẻ', en: 'Loose sack sales' },
      input: { item: SACK_ITEM, rate: new Decimal('0.5') },
      output: { item: MONEY_ITEM, perInputUnit: new Decimal(14) },
    },
    {
      id: 'peddle-billet',
      name: { vi: 'Bán phôi lẻ', en: 'Loose billet sales' },
      input: { item: BILLET_ITEM, rate: new Decimal('0.5') },
      output: { item: MONEY_ITEM, perInputUnit: new Decimal(40) },
    },
    {
      id: 'peddle-pallet',
      name: { vi: 'Bán pallet lẻ', en: 'Pallet sales' },
      input: { item: PALLET_ITEM, rate: new Decimal('0.5') },
      output: { item: MONEY_ITEM, perInputUnit: new Decimal(90) },
    },
    {
      id: 'peddle-crate',
      name: { vi: 'Bán kiện lẻ', en: 'Loose crate sales' },
      input: { item: CRATE_ITEM, rate: new Decimal('0.5') },
      output: { item: MONEY_ITEM, perInputUnit: new Decimal(90) },
    },
  ],
  upgrades: [
    {
      id: 'belt',
      name: { vi: 'Băng chuyền phân loại', en: 'Sorting Conveyor' },
      desc: {
        vi: '+50% tốc độ mọi công đoạn (kể cả bốc vác, ba gác)',
        en: '+50% speed on every step (hauling and carts included)',
      },
      cost: new Decimal(500),
      effects: [{ target: branchWorkerOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.5') }],
    },
    {
      id: 'scale',
      name: { vi: 'Cân điện tử chuẩn', en: 'Precision Scale' },
      desc: { vi: '+25% giá trị bán ra (mọi kênh)', en: '+25% sale value (all channels)' },
      cost: new Decimal(300),
      effects: [{ target: branchRecipeOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.25') }],
    },
    {
      id: 'big-bin',
      name: { vi: 'Mở rộng chỗ chứa', en: 'Expand the Scrap Heap' },
      desc: { vi: 'x2 sức chứa Sắt vụn ở khu ve chai', en: 'x2 scrap capacity in the scrap alley' },
      cost: new Decimal(200),
      effects: [{ target: itemCapacity(SCRAP_ITEM), kind: 'mult', value: new Decimal(2) }],
    },
    {
      id: 'pallet-yard',
      name: { vi: 'Bãi pallet', en: 'Pallet Yard' },
      desc: { vi: 'x2 sức chứa Pallet phôi', en: 'x2 billet pallet capacity' },
      cost: new Decimal(4000),
      effects: [{ target: itemCapacity(PALLET_ITEM), kind: 'mult', value: new Decimal(2) }],
    },
    {
      id: 'pickup',
      name: { vi: 'Xe bán tải', en: 'Pickup Truck' },
      desc: {
        vi: '+50% tốc độ; đổi cả đội xe trên tuyến sang xe bán tải',
        en: '+50% speed; upgrades the route fleet to pickup trucks',
      },
      cost: new Decimal(2000),
      effects: [{ target: branchWorkerOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.5') }],
      visual: { zone: 'route', tier: 1 },
    },
    {
      id: 'box-truck',
      name: { vi: 'Xe tải thùng', en: 'Box Truck' },
      desc: {
        vi: '+100% tốc độ; nâng tuyến lên xe tải thùng',
        en: '+100% speed; upgrades the route fleet to box trucks',
      },
      cost: new Decimal(25000),
      effects: [{ target: branchWorkerOutput(BRANCH_ID), kind: 'mult', value: new Decimal(2) }],
      visual: { zone: 'route', tier: 2 },
    },
  ],
}
