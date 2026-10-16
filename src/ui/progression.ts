import { formatShort } from '@core/format'
import type { Condition, GameContent, StatEffect } from '@domain/types'
import { UI, formatDuration } from '@i18n/text'
import type { Locale } from '@i18n/types'
import type { TranslateFn } from '@ui/hooks'

/**
 * UI-side phrasing of progression data: a condition ("what unlocks this") and a
 * reward effect ("what this milestone grants") both have to read as a sentence,
 * so their templates live in `i18n/text.ts` and the raw ids are resolved to the
 * names content already carries.
 */

export function describeCondition(
  text: TranslateFn,
  locale: Locale,
  content: GameContent,
  condition: Condition,
): string {
  switch (condition.kind) {
    case 'workers': {
      const worker = content.branches[condition.branch]?.workers.find(
        (candidate) => candidate.id === condition.worker,
      )
      const name = worker ? text(worker.name) : condition.worker
      return text(UI.reqWorkers, { count: String(condition.count), worker: name })
    }
    case 'upgrade': {
      const upgrade = content.branches[condition.branch]?.upgrades.find(
        (candidate) => candidate.id === condition.upgrade,
      )
      const name = upgrade ? text(upgrade.name) : condition.upgrade
      return text(UI.reqUpgrade, { upgrade: name })
    }
    case 'totalEarned':
      return text(UI.reqEarn, { amount: formatShort(condition.amount) })
    case 'playTime':
      return text(UI.reqPlayTime, { time: formatDuration(condition.seconds, locale) })
  }
}

const BRANCH_OUTPUT_KEY = /^branch\.[^.]+\.workerOutput$/
const BRANCH_RECIPE_KEY = /^branch\.[^.]+\.recipeOutput$/
const STEP_OUTPUT_KEY = /^branch\.([^.]+)\.worker\.([^.]+)\.output$/
const ITEM_CAPACITY_KEY = /^item\.([^.]+)\.capacity$/

/** "tốc độ xe ba gác ×1.1" — a readable label for one stat effect. */
export function describeEffect(text: TranslateFn, content: GameContent, effect: StatEffect): string {
  const value = effect.kind === 'flat' ? `+${formatShort(effect.value)}` : `×${formatShort(effect.value)}`
  return `${effectLabel(text, content, effect.target)} ${value}`
}

function effectLabel(text: TranslateFn, content: GameContent, target: string): string {
  if (BRANCH_OUTPUT_KEY.test(target)) return text(UI.effectBranchSpeed)
  if (BRANCH_RECIPE_KEY.test(target)) return text(UI.effectSaleValue)
  const step = STEP_OUTPUT_KEY.exec(target)
  if (step) {
    const [, branchId = '', workerId = ''] = step
    const worker = content.branches[branchId]?.workers.find((candidate) => candidate.id === workerId)
    return text(UI.effectWorkerSpeed, { worker: worker ? text(worker.name) : workerId })
  }
  const capacity = ITEM_CAPACITY_KEY.exec(target)
  if (capacity) {
    const [, itemId = ''] = capacity
    const item = content.items[itemId]
    return text(UI.effectCapacity, { item: item ? text(item.name) : itemId })
  }
  if (target === 'global.workerOutput') return text(UI.effectGlobalSpeed)
  return target
}
