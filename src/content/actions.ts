import { Decimal } from '@core/num'
import type { ManualActionDef } from '@domain/types'
import { BILLET_ITEM, CRATE_ITEM, PALLET_ITEM, SACK_ITEM, SCRAP_ITEM } from './items'

/**
 * Việc làm bằng tay: đứng trong khu, giữ phím cho tới hết `workSeconds` thì dây
 * chuyền nhận đúng một "nhát" — cùng biến đổi mà thợ trong khu làm mỗi giây, nhân
 * chừng 1,5–2× để tự làm có nghĩa lúc đầu và thành tuỳ chọn về sau. Đây là EVENT
 * (command), không phải rate: chỉ chạy khi người chơi giữ phím.
 *
 * Số ở đây là data — chỉnh cho tới khi thấy "đáng công" mà không đụng baseline
 * vàng (việc tay không bao giờ tự chạy trong test).
 */
export const MANUAL_ACTIONS: readonly ManualActionDef[] = [
  {
    id: 'haul-sacks',
    name: { vi: 'Vác bao', en: 'Haul sacks' },
    desc: { vi: 'Bốc sắt vụn đóng thành bao, vác sang chỗ chờ.', en: 'Bag the scrap and carry it to the pickup spot.' },
    zone: 'alley',
    pose: 'pick',
    workSeconds: 1.2,
    input: { item: SCRAP_ITEM, amount: new Decimal(3) },
    output: { item: SACK_ITEM, amount: new Decimal(3) },
  },
  {
    id: 'poke-cans',
    name: { vi: 'Chọt lon', en: 'Poke cans' },
    desc: { vi: 'Chọc que vào đống phế liệu, nhặt sắt vụn bỏ vào bao.', en: 'Work the pile with a stick and gather scrap.' },
    zone: 'alley',
    pose: 'poke',
    workSeconds: 1.2,
    output: { item: SCRAP_ITEM, amount: new Decimal(2) },
  },
  {
    id: 'hammer-billets',
    name: { vi: 'Đập đe', en: 'Hammer billets' },
    desc: { vi: 'Nện bao phế liệu lên đe thành phôi tái chế.', en: 'Beat the sacks on the anvil into recycled billets.' },
    zone: 'recycle',
    pose: 'hammer',
    workSeconds: 1.6,
    input: { item: SACK_ITEM, amount: new Decimal(2) },
    output: { item: BILLET_ITEM, amount: new Decimal(2) },
  },
  {
    id: 'pack-crates',
    name: { vi: 'Đóng kiện', en: 'Pack crates' },
    desc: { vi: 'Xếp phôi lên pallet rồi đóng thành kiện hàng.', en: 'Stack pallets and nail them into shipping crates.' },
    zone: 'depot',
    pose: 'pick',
    workSeconds: 1.8,
    input: { item: PALLET_ITEM, amount: new Decimal(3) },
    output: { item: CRATE_ITEM, amount: new Decimal(3) },
  },
]
