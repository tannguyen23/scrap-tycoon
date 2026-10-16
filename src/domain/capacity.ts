import { Decimal } from '@core/num'
import type { Modifiers } from './modifiers'
import { applyModifiers, mergeModifiers } from './modifiers'
import { GLOBAL_CARRY, itemCapacity, itemCarry } from './statKeys'
import type { GameContent, ItemId } from './types'

/**
 * Sức chứa kho. Cap là data trong content (`ItemDef.cap`), nâng được qua upgrade
 * target `item.<id>.capacity`. KHÔNG merge `global.workerOutput` vào đây — thời
 * tiết làm chậm thợ chứ không được co thùng.
 */
export function itemCapFor(
  content: GameContent,
  itemId: ItemId,
  mods: Map<string, Modifiers>,
): Decimal | null {
  const cap = content.items[itemId]?.cap
  if (!cap) return null
  return applyModifiers(cap, mods.get(itemCapacity(itemId)))
}

/**
 * Sức chứa TÚI của người chơi cho một loại hàng (`ItemDef.carry`) — trần riêng
 * của túi, không dính gì tới sức chứa kho của khu. Nâng bằng upgrade target
 * `item.<id>.carry`, cộng thêm hệ số chung `global.carry` từ trang bị (merge ở
 * đây, đúng luật "khoá riêng phải merge với khoá global"); `null` = không giới
 * hạn (hàng không bao giờ nằm trong túi, ví dụ tiền, cũng rơi vào đây).
 */
export function carryCapFor(
  content: GameContent,
  itemId: ItemId,
  mods: Map<string, Modifiers>,
): Decimal | null {
  const carry = content.items[itemId]?.carry
  if (!carry) return null
  const merged = mergeModifiers(mods.get(itemCarry(itemId)), mods.get(GLOBAL_CARRY))
  return applyModifiers(carry, merged)
}

/**
 * true khi rates phụ thuộc vào tồn kho (có cap, hoặc có worker vận chuyển) —
 * lúc đó offline không thể tính bằng một bước lớn, phải cắt chunk.
 */
export function hasStockDynamics(content: GameContent): boolean {
  for (const item of Object.values(content.items)) {
    if (item.cap) return true
  }
  for (const branch of Object.values(content.branches)) {
    for (const worker of branch.workers) {
      if (worker.input) return true
    }
  }
  return false
}
