import { Decimal } from '@core/num'
import { branchRecipeOutput, branchWorkerOutput } from '@domain/statKeys'
import type { BranchDef } from '@domain/types'
import { MONEY_ITEM, SCRAP_ITEM } from '../items'

const BRANCH_ID = 'scrap'
const COST_GROWTH = new Decimal('1.15')

/**
 * Phase 1 branch: collect scrap, sell it automatically. Everything here is data —
 * the Phase 2 branches (electronics, vehicles, cars) are added the same way.
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
      id: 'cart',
      name: { vi: 'Xe ba gác', en: 'Three-wheel Cart' },
      baseCost: new Decimal(115),
      costGrowth: COST_GROWTH,
      output: { item: SCRAP_ITEM, ratePerUnit: new Decimal(8) },
      visual: { zone: 'route', action: 'drive' },
    },
    {
      id: 'depot',
      name: { vi: 'Điểm thu mua', en: 'Buying Depot' },
      baseCost: new Decimal(1300),
      costGrowth: COST_GROWTH,
      output: { item: SCRAP_ITEM, ratePerUnit: new Decimal(60) },
      visual: { zone: 'depot', action: 'work' },
    },
    {
      id: 'truck',
      name: { vi: 'Xe tải phế liệu', en: 'Scrap Truck' },
      baseCost: new Decimal(15000),
      costGrowth: COST_GROWTH,
      output: { item: SCRAP_ITEM, ratePerUnit: new Decimal(400) },
      visual: { zone: 'gate', action: 'haul' },
    },
  ],
  recipes: [
    {
      id: 'auto-sell',
      name: { vi: 'Bán phế liệu', en: 'Scrap Sales' },
      input: { item: SCRAP_ITEM, rate: null },
      output: { item: MONEY_ITEM, perInputUnit: new Decimal(1) },
    },
  ],
  upgrades: [
    {
      id: 'belt',
      name: { vi: 'Băng chuyền phân loại', en: 'Sorting Conveyor' },
      desc: { vi: '+50% tốc độ thu gom của nhân công', en: '+50% worker output' },
      cost: new Decimal(500),
      effects: [{ target: branchWorkerOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.5') }],
    },
    {
      id: 'scale',
      name: { vi: 'Cân điện tử chuẩn', en: 'Precision Scale' },
      desc: { vi: '+25% giá trị phế liệu bán ra', en: '+25% value per scrap sold' },
      cost: new Decimal(300),
      effects: [{ target: branchRecipeOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.25') }],
    },
  ],
}
