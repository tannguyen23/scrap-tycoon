import type { L10n, Locale } from './types'

/** UI chrome strings. Content (items, branches, workers...) carries its own L10n inline. */
export const UI = {
  buy: { vi: 'Mua', en: 'Buy' },
  buyMax: { vi: 'Tối đa', en: 'Max' },
  incomePerSecond: { vi: 'Thu nhập/s', en: 'Income/s' },
  workers: { vi: 'Nhân công', en: 'Workers' },
  upgrades: { vi: 'Nâng cấp', en: 'Upgrades' },
  owned: { vi: 'Đang có', en: 'Owned' },
  nextCost: { vi: 'Giá kế tiếp', en: 'Next cost' },
  purchased: { vi: 'Đã mua', en: 'Purchased' },
  settings: { vi: 'Cài đặt', en: 'Settings' },
  language: { vi: 'Ngôn ngữ', en: 'Language' },
  close: { vi: 'Đóng', en: 'Close' },
  resetSave: { vi: 'Xoá save', en: 'Reset save' },
  resetSaveConfirm: {
    vi: 'Xoá toàn bộ tiến độ và quay lại từ đầu?',
    en: 'Delete all progress and start over?',
  },
  offlineTitle: { vi: 'Chào mừng trở lại!', en: 'Welcome back!' },
  offlineBody: {
    vi: 'Bạn đã vắng {time} và kiếm được +{amount}.',
    en: 'You were away for {time} and earned +{amount}.',
  },
  offlineCapped: {
    vi: 'Chỉ tính tối đa {time} mỗi lần vắng.',
    en: 'Only up to {time} counts per absence.',
  },
  ok: { vi: 'OK', en: 'OK' },
} satisfies Record<string, L10n>

export const LANGUAGE_NAMES: Record<Locale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
}

const HOUR_SHORT: L10n = { vi: 'g', en: 'h' }
const MINUTE_SHORT: L10n = { vi: 'p', en: 'm' }
const SECOND_SHORT: L10n = { vi: 'gi', en: 's' }

export function formatDuration(totalSeconds: number, locale: Locale): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return `${hours}${HOUR_SHORT[locale]} ${minutes}${MINUTE_SHORT[locale]}`
  if (minutes > 0) return `${minutes}${MINUTE_SHORT[locale]} ${rest}${SECOND_SHORT[locale]}`
  return `${rest}${SECOND_SHORT[locale]}`
}
