import { D0, Decimal } from '@core/num'

/** Cost of the (owned + i)-th unit. */
export function unitCost(baseCost: Decimal, growth: Decimal, owned: number): Decimal {
  return baseCost.mul(growth.pow(owned))
}

/** Total cost of `count` units starting at `owned` — closed form of the geometric series. */
export function bulkCost(baseCost: Decimal, growth: Decimal, owned: number, count: number): Decimal {
  if (count <= 0) return D0
  const first = unitCost(baseCost, growth, owned)
  if (growth.eq(1)) return first.mul(count)
  const factor = growth.pow(count).sub(1).div(growth.sub(1))
  return first.mul(factor)
}

/** Largest number of units affordable with `budget`, capped at `limit`. */
export function maxAffordable(
  baseCost: Decimal,
  growth: Decimal,
  owned: number,
  budget: Decimal,
  limit = 1_000_000,
): number {
  const first = unitCost(baseCost, growth, owned)
  if (budget.lt(first)) return 0
  if (growth.eq(1)) return Math.min(limit, budget.div(first).floor().toNumber())

  // budget >= first × (gⁿ − 1) / (g − 1)  ⇔  n <= log_g(1 + budget × (g − 1) / first)
  const inner = budget.mul(growth.sub(1)).div(first).add(1)
  let count = Math.floor(inner.log10().div(growth.log10()).toNumber())
  if (!Number.isFinite(count) || count > limit) count = limit
  count = Math.max(0, count)

  // guard against float drift at the boundary (bounded, at most a couple of steps)
  let guard = 0
  while (count > 0 && bulkCost(baseCost, growth, owned, count).gt(budget) && guard < 4) {
    count -= 1
    guard += 1
  }
  guard = 0
  while (count < limit && bulkCost(baseCost, growth, owned, count + 1).lte(budget) && guard < 4) {
    count += 1
    guard += 1
  }
  return count
}
