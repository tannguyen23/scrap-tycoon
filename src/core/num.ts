import Decimal from 'break_eternity.js'

export { Decimal }

export const D0 = new Decimal(0)
export const D1 = new Decimal(1)

export function minDec(a: Decimal, b: Decimal): Decimal {
  return a.lte(b) ? a : b
}
