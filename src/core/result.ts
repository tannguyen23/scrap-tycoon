export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string }

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function fail<T = never>(reason: string): Result<T> {
  return { ok: false, reason }
}
