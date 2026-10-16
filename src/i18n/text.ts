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
  menu: { vi: 'Menu', en: 'Menu' },
  menuHint: { vi: 'Mở menu nâng cấp, mốc tiến trình & cài đặt', en: 'Open the upgrades, milestones & settings menu' },
  progress: { vi: 'Tiến trình', en: 'Progress' },
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
  zoom: { vi: 'Thu phóng', en: 'Zoom' },
  zoneJump: { vi: 'Bấm để di chuyển camera tới khu này', en: 'Click to move the camera to this zone' },
  minimapHint: {
    vi: 'Bấm lên bản đồ để camera tới chỗ đó',
    en: 'Click the map to jump there',
  },
  milestones: { vi: 'Mốc tiến trình', en: 'Milestones' },
  locked: { vi: 'Khoá', en: 'Locked' },
  achieved: { vi: 'Đã đạt', en: 'Achieved' },
  milestoneReached: { vi: 'Đạt mốc: {name}', en: 'Milestone reached: {name}' },
  rewardLabel: { vi: 'Thưởng: {reward}', en: 'Reward: {reward}' },
  reqWorkers: { vi: 'Cần {count}× {worker}', en: 'Needs {count}× {worker}' },
  reqUpgrade: { vi: 'Cần nâng cấp “{upgrade}”', en: 'Needs the “{upgrade}” upgrade' },
  reqEarn: { vi: 'Cần kiếm tổng {amount}', en: 'Earn {amount} in total' },
  reqPlayTime: { vi: 'Cần chơi đủ {time}', en: 'Play for {time}' },
  effectBranchSpeed: { vi: 'tốc độ dây chuyền', en: 'chain speed' },
  effectSaleValue: { vi: 'giá bán', en: 'sale value' },
  effectWorkerSpeed: { vi: 'tốc độ {worker}', en: '{worker} speed' },
  effectCapacity: { vi: 'sức chứa {item}', en: '{item} capacity' },
  effectGlobalSpeed: { vi: 'tốc độ mọi thợ', en: 'all worker speed' },
  moveHint: {
    vi: 'WASD để đi · Shift để chạy · E mở túi đồ',
    en: 'WASD to walk · Shift to run · E for your bag',
  },
  workHold: { vi: 'Giữ {key} — {name}', en: 'Hold {key} — {name}' },
  holdWord: { vi: 'GIỮ', en: 'HOLD' },
  lootGain: { vi: '+{amount} {name}', en: '+{amount} {name}' },
  bag: { vi: 'Túi đồ', en: 'Bag' },
  character: { vi: 'Nhân vật', en: 'Character' },
  bagHint: { vi: 'Phím E mở/đóng túi đồ & trang bị', en: 'Press E for your bag and gear' },
  invHint: { vi: 'Kéo thả để sắp ô · kéo sang kho khu để bỏ hàng · E hoặc Esc để đóng', en: 'Drag to rearrange · drag to the yard bin to store · E or Esc to close' },
  invStoreHint: { vi: '{name} — bấm để bỏ vào kho', en: '{name} — click to store' },
  invTakeHint: { vi: '{name} — bấm để lấy vào túi', en: '{name} — click to take' },
  bagEmpty: {
    vi: 'Túi đang trống — giữ F để làm việc bằng tay.',
    en: 'Your bag is empty — hold F to work by hand.',
  },
  bagCarried: { vi: 'Đang mang', en: 'Carrying' },
  bagHere: { vi: 'Kho khu đang đứng', en: 'Warehouse here' },
  bagNoZone: {
    vi: 'Đứng trong khu để bốc hàng từ kho, hoặc bỏ hàng vào kho.',
    en: 'Stand in a yard to pick goods up from its warehouse, or store what you carry.',
  },
  bagNeedZone: { vi: 'Hàng này thuộc khu {zone}', en: 'This belongs to {zone}' },
  gear: { vi: 'Trang bị', en: 'Gear' },
  gearHint: { vi: 'Mua đồ rồi mặc luôn — đổi cả hình nhân vật lẫn chỉ số.', en: 'Buy a piece and it is worn — it changes both your look and your stats.' },
  gearWearing: { vi: 'Đang mặc', en: 'Worn' },
  gearHeld: { vi: 'Đang cầm', en: 'In hand' },
  gearHeldHint: { vi: 'Đồ nghề theo việc làm ở khu đang đứng.', en: 'Tools follow the job you would do here.' },
  gearNone: { vi: 'Không cầm gì', en: 'Nothing in hand' },
  gearHat: { vi: 'Nón', en: 'Hat' },
  gearShirt: { vi: 'Áo', en: 'Shirt' },
  gearPants: { vi: 'Quần', en: 'Pants' },
  gearBoots: { vi: 'Dép', en: 'Boots' },
  reasonNotEnoughMoney: { vi: 'Không đủ tiền', en: 'Not enough money' },
  reasonNoInput: { vi: 'Kho khu không đủ nguyên liệu', en: 'Not enough material in the yard' },
  reasonZoneFull: { vi: 'Kho khu đã đầy', en: 'The yard bin is full' },
  reasonBagFull: { vi: 'Túi đã đầy loại hàng này', en: 'Your bag is full of this' },
  reasonEmptyBag: { vi: 'Túi không còn loại hàng này', en: 'No such item left in your bag' },
  reasonNoStock: { vi: 'Kho khu không còn hàng này', en: 'The yard has none of this' },
  reasonWrongZone: { vi: 'Hàng này không thuộc kho khu đang đứng', en: 'This does not belong to this yard' },
  ok: { vi: 'OK', en: 'OK' },
  backToPlayer: { vi: 'Về nhân vật', en: 'Back to player' },
  backToPlayerHint: {
    vi: 'Đưa camera về chỗ nhân vật đang đứng',
    en: 'Bring the camera back to the player',
  },
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
