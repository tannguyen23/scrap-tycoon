import { Decimal, D0 } from './num'

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'] as const

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

/** Compact display format for idle-game numbers: 1.23K, 4.5M, 7.89Qa, ... */
export function formatShort(value: Decimal): string {
  if (value.lt(D0)) return `-${formatShort(value.neg())}`
  if (value.eq(D0)) return '0'
  if (value.lt(1000)) {
    const n = value.toNumber()
    return n < 100 ? trimZeros(n.toFixed(2)) : trimZeros(n.toFixed(1))
  }
  const exponent = value.log10().floor()
  const tier = exponent.div(3).floor().toNumber()
  const suffix = SUFFIXES[tier]
  if (suffix === undefined) return value.toString()
  const mantissa = value.div(Decimal.pow(10, exponent)).toNumber()
  return `${mantissa.toFixed(2)}${suffix}`
}
