import type { WeatherKindDef, WeatherProfile, WeatherVisual } from './types'

/**
 * Lịch thời tiết — THUẦN và tất định: mọi thứ suy ra từ `state.stats.playTimeS`
 * (đã persist sẵn), nên không có state thời tiết trong save, reload giữa bão vẫn
 * đang bão, và online/offline dùng chung đúng một lịch.
 */

/**
 * Hash kiểu murmur3 (có avalanche) — hash yếu làm lịch thời tiết thoái hoá thành
 * chu kỳ ngắn lặp đi lặp lại (bài học từ trường nhiễu của tileset).
 */
function hash01(n: number): number {
  let h = n | 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export function weatherBlockIndex(profile: WeatherProfile, playTimeS: number): number {
  return Math.floor(Math.max(0, playTimeS) / profile.blockSeconds)
}

/** Giây còn lại tới biên block kế tiếp — dùng để cắt chunk khi tính offline. */
export function secondsUntilNextBlock(profile: WeatherProfile, playTimeS: number): number {
  const at = Math.max(0, playTimeS)
  return (weatherBlockIndex(profile, at) + 1) * profile.blockSeconds - at
}

function pickKind(profile: WeatherProfile, blockIndex: number): WeatherKindDef | null {
  const first = profile.kinds[0]
  if (!first) return null
  // Block đầu tiên luôn là kind đầu tiên: trời đẹp mở màn cho người mới (và giữ
  // 10 phút đầu của golden balance test không bị phạt thời tiết).
  if (blockIndex <= 0) return first

  const total = profile.kinds.reduce((sum, kind) => sum + kind.weight, 0)
  let roll = hash01(blockIndex) * total
  for (const kind of profile.kinds) {
    roll -= kind.weight
    if (roll <= 0) return kind
  }
  return profile.kinds[profile.kinds.length - 1] ?? first
}

export function weatherAt(profile: WeatherProfile, playTimeS: number): WeatherKindDef | null {
  return pickKind(profile, weatherBlockIndex(profile, playTimeS))
}

/** Hệ số tốc độ thợ của đợt thời tiết đang diễn ra (rời rạc theo block). */
export function weatherWorkMultiplier(profile: WeatherProfile, playTimeS: number): number {
  return weatherAt(profile, playTimeS)?.workMultiplier ?? 1
}

export interface WeatherVisualMix {
  from: WeatherVisual
  to: WeatherVisual
  /** 0..1 trong `transitionSeconds` đầu block — UI tự ease. */
  mix: number
}

/** Trộn hình ảnh giữa đợt trước và đợt hiện tại để chuyển mùa mượt. */
export function weatherVisualMix(profile: WeatherProfile, playTimeS: number): WeatherVisualMix | null {
  const at = Math.max(0, playTimeS)
  const index = weatherBlockIndex(profile, at)
  const to = pickKind(profile, index)
  if (!to) return null
  const from = index > 0 ? (pickKind(profile, index - 1) ?? to) : to
  const elapsed = at - index * profile.blockSeconds
  const mix = Math.min(1, elapsed / Math.max(0.001, profile.transitionSeconds))
  return { from: from.visual, to: to.visual, mix }
}
