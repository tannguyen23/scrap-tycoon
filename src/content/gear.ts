import { Decimal } from '@core/num'
import type { GearDef } from '@domain/types'
import { GLOBAL_CARRY, PLAYER_WALK_SPEED, PLAYER_WORK_SPEED } from '@domain/statKeys'

/**
 * Trang bị của nhân vật — mua một lần bằng tiền, mặc luôn (mỗi ô một món), và
 * cộng chỉ số qua đúng pipeline modifier. `style` là khoá art tra trong
 * `ui/scene/focus/parts.ts`; nhân vật chưa mua gì vẫn giữ nguyên hình cũ.
 *
 * Giá và hệ số ở đây là data — chỉnh cho tới khi thấy đáng mua, và nhớ: đồ **phải
 * mua mới có**, nên bonus không bao giờ lọt vào envelope của golden test.
 */
export const GEAR: readonly GearDef[] = [
  {
    id: 'vest',
    slot: 'shirt',
    name: { vi: 'Áo phản quang', en: 'Hi-vis Vest' },
    desc: {
      vi: 'Áo có túi: mang được nhiều hàng hơn trong túi.',
      en: 'Pocketed vest: carry more in your bag.',
    },
    cost: new Decimal(250),
    effects: [{ target: GLOBAL_CARRY, kind: 'mult', value: new Decimal('1.25') }],
    style: 'vest',
  },
  {
    id: 'overalls',
    slot: 'pants',
    name: { vi: 'Quần yếm thợ', en: 'Work Overalls' },
    desc: {
      vi: 'Quần yếm nhiều túi hộp: túi lại chứa thêm được chút nữa.',
      en: 'Overalls with boxy pockets: a little more room in the bag.',
    },
    cost: new Decimal(400),
    effects: [{ target: GLOBAL_CARRY, kind: 'mult', value: new Decimal('1.15') }],
    style: 'overalls',
    requires: { kind: 'workers', branch: 'scrap', worker: 'scavenger', count: 3 },
  },
  {
    id: 'hard-hat',
    slot: 'hat',
    name: { vi: 'Nón bảo hộ', en: 'Hard Hat' },
    desc: {
      vi: 'Đội nón làm tay nhanh hơn: nhát lao động chạy mau hơn.',
      en: 'Work by hand goes faster with a hard hat on.',
    },
    cost: new Decimal(600),
    effects: [{ target: PLAYER_WORK_SPEED, kind: 'mult', value: new Decimal('1.15') }],
    style: 'hard',
    requires: { kind: 'workers', branch: 'scrap', worker: 'porter', count: 1 },
  },
  {
    id: 'rubber-boots',
    slot: 'boots',
    name: { vi: 'Ủng cao su', en: 'Rubber Boots' },
    desc: {
      vi: 'Đi nhanh hơn — bùn nước không cản nổi.',
      en: 'Walk faster — mud and puddles do not slow these down.',
    },
    cost: new Decimal(900),
    effects: [{ target: PLAYER_WALK_SPEED, kind: 'mult', value: new Decimal('1.2') }],
    style: 'boot',
    requires: { kind: 'workers', branch: 'scrap', worker: 'cart', count: 1 },
  },
]
