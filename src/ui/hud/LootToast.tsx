import { formatShort } from '@core/format'
import type { ItemId } from '@domain/types'
import { UI } from '@i18n/text'
import { useContent, useText } from '@ui/hooks'
import type Decimal from 'break_eternity.js'

export interface LootToastProps {
  item: ItemId
  amount: Decimal
}

/**
 * "+2 Sắt vụn" — nhặt xong là biết ngay vừa được gì, bao nhiêu. Dismiss timing do
 * `App` giữ (cùng kiểu với `MilestoneToast`), tên món đọc tại chỗ nên đổi ngôn ngữ
 * là nhãn còn trên màn cũng đổi theo.
 */
export function LootToast({ item, amount }: LootToastProps) {
  const content = useContent()
  const text = useText()
  const name = content.items[item]?.name
  return (
    <div className="loot-toast" role="status">
      {text(UI.lootGain, { amount: formatShort(amount), name: name ? text(name) : item })}
    </div>
  )
}
