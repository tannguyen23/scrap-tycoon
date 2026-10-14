import { Decimal } from '@core/num'
import type { Modifiers } from './modifiers'
import { applyModifiers } from './modifiers'
import { itemCapacity } from './statKeys'
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
