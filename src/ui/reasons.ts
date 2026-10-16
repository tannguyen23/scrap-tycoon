import { UI } from '@i18n/text'
import type { TranslateFn } from '@ui/hooks'

/**
 * Domain commands report failures as reason strings (`Result.reason`); this is the
 * one place they turn into something the player can read. Shared by the work bar
 * and the inventory panel so both tell the same story about the same failure.
 */
export function describeReason(text: TranslateFn, reason: string): string {
  if (reason === 'no-input') return text(UI.reasonNoInput)
  if (reason === 'zone-full') return text(UI.reasonZoneFull)
  if (reason === 'bag-full') return text(UI.reasonBagFull)
  if (reason === 'empty-bag') return text(UI.reasonEmptyBag)
  if (reason === 'no-stock') return text(UI.reasonNoStock)
  if (reason === 'wrong-zone') return text(UI.reasonWrongZone)
  if (reason === 'not-enough-money') return text(UI.reasonNotEnoughMoney)
  if (reason === 'locked') return text(UI.locked)
  return ''
}
