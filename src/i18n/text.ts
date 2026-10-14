import type { L10n, Locale } from './types'

/** UI chrome strings. Content (items, branches, workers...) carries its own L10n inline. */
export const UI = {
  buy: { vi: 'Mua', en: 'Buy' },
  buyMax: { vi: 'Tối đa', en: 'Max' },
  incomePerSecond: { vi: 'Thu nhập/s', en: 'Income/s' },
  workers: { vi: 'Nhân công', en: 'Workers' },
  upgrades: { vi: 'Nâng cấp chung', en: 'Shared upgrades' },
  owned: { vi: 'Đang có', en: 'Owned' },
  nextCost: { vi: 'Giá kế tiếp', en: 'Next cost' },
  costProgress: { vi: 'Tiến độ tới giá kế tiếp', en: 'Progress toward next cost' },
  purchased: { vi: 'Đã mua', en: 'Purchased' },
  settings: { vi: 'Cài đặt', en: 'Settings' },
  language: { vi: 'Ngôn ngữ', en: 'Language' },
  theme: { vi: 'Giao diện', en: 'Theme' },
  themeLight: { vi: 'Sáng', en: 'Light' },
  themeDark: { vi: 'Tối', en: 'Dark' },
  close: { vi: 'Đóng', en: 'Close' },
  sound: { vi: 'Âm thanh', en: 'Sound' },
  soundMute: { vi: 'Tắt tiếng', en: 'Mute' },
  soundUnmute: { vi: 'Bật tiếng', en: 'Unmute' },
  weather: { vi: 'Thời tiết — ảnh hưởng tốc độ thợ', en: 'Weather — affects worker speed' },
  stock: { vi: 'Tồn', en: 'Stock' },
  full: { vi: 'Đầy', en: 'Full' },
  saleChannels: { vi: 'Kênh bán lẻ (vớt hàng dư)', en: 'Sales channels (surplus)' },
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
  zoomFar: { vi: 'Xa · ít chi tiết', en: 'Far · less detail' },
  zoomMid: { vi: 'Vừa', en: 'Medium' },
  zoomNear: { vi: 'Gần · chi tiết nhất', en: 'Close · most detail' },
  zoneJump: { vi: 'Bấm để di chuyển camera tới khu này', en: 'Click to move the camera to this zone' },
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
