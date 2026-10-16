import { Decimal } from '@core/num'
import { branchRecipeOutput, branchWorkerOutput, workerStepOutput } from '@domain/statKeys'
import type { MilestoneDef } from '@domain/types'

const BRANCH_ID = 'scrap'

/**
 * Mốc tiến trình của nhánh đồng nát. Mỗi mốc là một điều kiện ĐƠN ĐIỆU TĂNG
 * (số thợ / tổng tiền / thời gian chơi chỉ tăng) cộng thưởng hệ số vĩnh viễn:
 * điều kiện được suy thẳng từ state nên không ghi gì vào save, mốc đã đạt không
 * bao giờ mất và thêm mốc mới không cần migration.
 */
export const MILESTONES: readonly MilestoneDef[] = [
  {
    id: 'crew-five',
    name: { vi: 'Đội nhặt đông đủ', en: 'Full Crew' },
    desc: { vi: 'Có 5 người nhặt ve chai cùng chọt lon.', en: 'Put 5 scavengers on the piles.' },
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'scavenger', count: 5 },
    reward: [{ target: branchWorkerOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.05') }],
  },
  {
    id: 'forge-fired',
    name: { vi: 'Lò đã nóng', en: 'Forge Fired Up' },
    desc: { vi: 'Đưa thợ rèn đầu tiên vào xưởng tái chế.', en: 'Get the first forge worker on the anvil.' },
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'smelter', count: 1 },
    reward: [{ target: workerStepOutput(BRANCH_ID, 'smelter'), kind: 'mult', value: new Decimal('1.05') }],
  },
  {
    id: 'first-thousand',
    name: { vi: 'Nghìn đầu tiên', en: 'First Thousand' },
    desc: { vi: 'Kiếm đủ 1.000 đồng.', en: 'Earn 1,000 coins in total.' },
    requires: { kind: 'totalEarned', amount: new Decimal(1000) },
    reward: [{ target: branchRecipeOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.03') }],
  },
  {
    id: 'cart-convoy',
    name: { vi: 'Đoàn ba gác', en: 'Cart Convoy' },
    desc: { vi: 'Cho 2 xe ba gác cùng chạy tuyến.', en: 'Run two carts on the route.' },
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'cart', count: 2 },
    reward: [{ target: workerStepOutput(BRANCH_ID, 'cart'), kind: 'mult', value: new Decimal('1.1') }],
  },
  {
    id: 'ten-thousand',
    name: { vi: 'Mười nghìn', en: 'Ten Thousand' },
    desc: { vi: 'Kiếm đủ 10.000 đồng.', en: 'Earn 10,000 coins in total.' },
    requires: { kind: 'totalEarned', amount: new Decimal(10_000) },
    reward: [{ target: branchRecipeOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.03') }],
  },
  {
    id: 'first-export',
    name: { vi: 'Chuyến hàng đầu tiên', en: 'First Export' },
    desc: {
      vi: 'Đưa chuyến xe tải xuất đầu tiên ra cổng thành.',
      en: 'Send the first export truck out the gate.',
    },
    requires: { kind: 'workers', branch: BRANCH_ID, worker: 'truck', count: 1 },
    reward: [{ target: branchWorkerOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.03') }],
  },
  {
    id: 'hundred-thousand',
    name: { vi: 'Ông trùm phế liệu', en: 'Scrap Tycoon' },
    desc: { vi: 'Kiếm đủ 250.000 đồng.', en: 'Earn 250,000 coins in total.' },
    requires: { kind: 'totalEarned', amount: new Decimal(250_000) },
    reward: [{ target: branchRecipeOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.1') }],
  },
  {
    id: 'veteran',
    name: { vi: 'Bền bỉ', en: 'Seasoned' },
    desc: { vi: 'Trụ lại bãi đủ 30 phút.', en: 'Stay on the yard for 30 minutes.' },
    requires: { kind: 'playTime', seconds: 1800 },
    reward: [{ target: branchWorkerOutput(BRANCH_ID), kind: 'mult', value: new Decimal('1.05') }],
  },
]
