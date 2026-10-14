import type { L10n } from '@i18n/types'

/**
 * Toàn bộ âm thanh của game được TỔNG HỢP bằng Web Audio (không có file âm thanh
 * nào trong repo) — đây là nguồn duy nhất cho mọi con số tinh chỉnh: tần số,
 * envelope, volume, cooldown. Game và asset studio cùng đọc bảng này.
 */
export const SOUND_GROUPS = ['ui', 'gate', 'alley', 'recycle', 'depot', 'route', 'ambient'] as const
export type SoundGroup = (typeof SOUND_GROUPS)[number]

export const SOUND_GROUP_LABELS: Record<SoundGroup, L10n> = {
  ui: { vi: 'Giao diện', en: 'UI' },
  gate: { vi: 'Cổng ra vào', en: 'Gate' },
  alley: { vi: 'Ngõ nhặt', en: 'Alley' },
  recycle: { vi: 'Xưởng tái chế', en: 'Forge' },
  depot: { vi: 'Nơi đóng hàng', en: 'Packing House' },
  route: { vi: 'Tuyến xe', en: 'Route' },
  ambient: { vi: 'Nền / thú vật', en: 'Ambient' },
}

export type SoundId =
  | 'click'
  | 'buy'
  | 'deny'
  | 'upgrade'
  | 'offline'
  | 'cash'
  | 'truck-arrive'
  | 'truck-depart'
  | 'sack-throw'
  | 'barrier'
  | 'poke'
  | 'sack-drop'
  | 'sack-lift'
  | 'vehicle-turn'
  | 'clang'
  | 'gull'
  | 'cat'
  | 'thunder'

interface LayerBase {
  durationMs: number
  delayMs?: number
  gain: number
  attackMs?: number
  releaseMs?: number
}

export interface ToneLayer extends LayerBase {
  kind: 'tone'
  type: OscillatorType
  freqFrom: number
  freqTo?: number
}

export interface NoiseLayer extends LayerBase {
  kind: 'noise'
  filter?: { type: BiquadFilterType; freq: number; q?: number }
}

export type SoundLayer = ToneLayer | NoiseLayer

export interface SoundSpec {
  readonly id: SoundId
  readonly group: SoundGroup
  readonly label: L10n
  readonly description: L10n
  /** Trọng số trộn 0..1, nhân tiếp với âm lượng tổng của người chơi. */
  readonly volume: number
  /** Khoảng cách tối thiểu giữa hai lần phát cùng id, tính bằng ms. */
  readonly cooldownMs: number
  readonly layers: readonly SoundLayer[]
}

const tone = (layer: Omit<ToneLayer, 'kind'>): ToneLayer => ({ kind: 'tone', ...layer })
const noise = (layer: Omit<NoiseLayer, 'kind'>): NoiseLayer => ({ kind: 'noise', ...layer })

export const SOUND_LIBRARY: Record<SoundId, SoundSpec> = {
  click: {
    id: 'click',
    group: 'ui',
    label: { vi: 'Tick', en: 'Tick' },
    description: {
      vi: 'Tick UI rất nhẹ: chip zoom, nút cài đặt, chọn khu trên bản đồ.',
      en: 'Very light UI tick: zoom chips, settings button, picking a zone on the map.',
    },
    volume: 0.5,
    cooldownMs: 40,
    layers: [
      tone({ type: 'triangle', freqFrom: 1200, freqTo: 900, durationMs: 34, gain: 0.5, attackMs: 2, releaseMs: 26 }),
      tone({ type: 'triangle', freqFrom: 1800, durationMs: 22, delayMs: 6, gain: 0.12, attackMs: 1, releaseMs: 16 }),
    ],
  },
  buy: {
    id: 'buy',
    group: 'ui',
    label: { vi: 'Mua', en: 'Buy' },
    description: {
      vi: 'Mua nhân công thành công (×1 / ×10 / tối đa).',
      en: 'Worker purchased (×1 / ×10 / max).',
    },
    volume: 0.5,
    cooldownMs: 120,
    layers: [
      tone({ type: 'square', freqFrom: 620, durationMs: 70, gain: 0.28, attackMs: 3, releaseMs: 55 }),
      tone({ type: 'square', freqFrom: 930, durationMs: 90, delayMs: 60, gain: 0.24, attackMs: 3, releaseMs: 70 }),
    ],
  },
  deny: {
    id: 'deny',
    group: 'ui',
    label: { vi: 'Từ chối', en: 'Denied' },
    description: {
      vi: 'Mua thất bại — không đủ tiền.',
      en: 'Purchase refused — not enough money.',
    },
    volume: 0.5,
    cooldownMs: 250,
    layers: [
      tone({ type: 'sawtooth', freqFrom: 150, freqTo: 110, durationMs: 200, gain: 0.3, attackMs: 8, releaseMs: 130 }),
      noise({ durationMs: 90, gain: 0.08, filter: { type: 'bandpass', freq: 500, q: 1.2 } }),
    ],
  },
  upgrade: {
    id: 'upgrade',
    group: 'ui',
    label: { vi: 'Nâng cấp', en: 'Upgrade' },
    description: {
      vi: 'Mua nâng cấp thành công — fanfare ba nốt.',
      en: 'Upgrade purchased — three-note fanfare.',
    },
    volume: 0.55,
    cooldownMs: 300,
    layers: [
      tone({ type: 'triangle', freqFrom: 523, durationMs: 110, gain: 0.3, attackMs: 3, releaseMs: 90 }),
      tone({ type: 'triangle', freqFrom: 659, durationMs: 110, delayMs: 75, gain: 0.3, attackMs: 3, releaseMs: 90 }),
      tone({ type: 'triangle', freqFrom: 784, durationMs: 170, delayMs: 150, gain: 0.32, attackMs: 3, releaseMs: 150 }),
      tone({ type: 'sine', freqFrom: 1568, durationMs: 200, delayMs: 150, gain: 0.1, attackMs: 10, releaseMs: 180 }),
    ],
  },
  offline: {
    id: 'offline',
    group: 'ui',
    label: { vi: 'Quay lại', en: 'Welcome back' },
    description: {
      vi: 'Chuông chào mừng trở lại khi mở modal thu nhập offline.',
      en: 'Welcome-back chime when the offline earnings modal opens.',
    },
    volume: 0.45,
    cooldownMs: 400,
    layers: [
      tone({ type: 'sine', freqFrom: 523, durationMs: 600, gain: 0.22, attackMs: 40, releaseMs: 480 }),
      tone({ type: 'sine', freqFrom: 784, durationMs: 500, delayMs: 120, gain: 0.16, attackMs: 40, releaseMs: 400 }),
      tone({ type: 'sine', freqFrom: 1046, durationMs: 420, delayMs: 260, gain: 0.1, attackMs: 20, releaseMs: 380 }),
    ],
  },
  cash: {
    id: 'cash',
    group: 'gate',
    label: { vi: 'Thu tiền', en: 'Cash' },
    description: {
      vi: 'Xe hàng qua trạm thu phí ở cổng — ka-ching.',
      en: 'Truck crosses the toll at the gate — ka-ching.',
    },
    volume: 0.5,
    cooldownMs: 250,
    layers: [
      tone({ type: 'square', freqFrom: 1568, durationMs: 40, gain: 0.2, attackMs: 2, releaseMs: 34 }),
      tone({ type: 'square', freqFrom: 2093, durationMs: 70, delayMs: 38, gain: 0.16, attackMs: 2, releaseMs: 60 }),
      tone({ type: 'triangle', freqFrom: 1046, durationMs: 260, delayMs: 44, gain: 0.14, attackMs: 4, releaseMs: 230 }),
      noise({ durationMs: 26, gain: 0.1, filter: { type: 'highpass', freq: 4000 } }),
    ],
  },
  'truck-arrive': {
    id: 'truck-arrive',
    group: 'gate',
    label: { vi: 'Xe tới', en: 'Truck arrives' },
    description: {
      vi: 'Xe tải hạ phanh vào bến, cửa cuốn mở.',
      en: 'Truck brakes into the bay, roll door opens.',
    },
    volume: 0.45,
    cooldownMs: 400,
    layers: [
      noise({ durationMs: 320, gain: 0.2, attackMs: 40, releaseMs: 260, filter: { type: 'bandpass', freq: 700, q: 0.9 } }),
      tone({ type: 'sine', freqFrom: 95, freqTo: 62, durationMs: 220, gain: 0.28, attackMs: 6, releaseMs: 180 }),
    ],
  },
  'truck-depart': {
    id: 'truck-depart',
    group: 'gate',
    label: { vi: 'Xe chạy', en: 'Truck departs' },
    description: {
      vi: 'Xe tải rồ máy rời bến.',
      en: 'Truck revs up and departs.',
    },
    volume: 0.45,
    cooldownMs: 400,
    layers: [
      tone({ type: 'sawtooth', freqFrom: 82, freqTo: 150, durationMs: 480, gain: 0.2, attackMs: 70, releaseMs: 240 }),
      tone({ type: 'square', freqFrom: 165, freqTo: 300, durationMs: 420, gain: 0.07, attackMs: 80, releaseMs: 220 }),
      noise({ durationMs: 260, gain: 0.1, attackMs: 60, releaseMs: 180, filter: { type: 'lowpass', freq: 500 } }),
    ],
  },
  'sack-throw': {
    id: 'sack-throw',
    group: 'gate',
    label: { vi: 'Ném bao', en: 'Sack throw' },
    description: {
      vi: 'Bao được ném vào thùng xe đang mở.',
      en: 'Sack tossed into the open truck bed.',
    },
    volume: 0.45,
    cooldownMs: 90,
    layers: [
      noise({ durationMs: 130, gain: 0.14, attackMs: 20, releaseMs: 100, filter: { type: 'bandpass', freq: 1300, q: 0.9 } }),
      tone({ type: 'sine', freqFrom: 125, freqTo: 70, durationMs: 140, delayMs: 85, gain: 0.4, attackMs: 3, releaseMs: 120 }),
    ],
  },
  barrier: {
    id: 'barrier',
    group: 'gate',
    label: { vi: 'Thanh chắn', en: 'Barrier' },
    description: {
      vi: 'Thanh chắn cổng mở/đóng — clack cơ khí.',
      en: 'Gate boom barrier opens/closes — mechanical clack.',
    },
    volume: 0.4,
    cooldownMs: 150,
    layers: [
      noise({ durationMs: 45, gain: 0.22, attackMs: 2, releaseMs: 40, filter: { type: 'bandpass', freq: 1800, q: 3.5 } }),
      tone({ type: 'square', freqFrom: 320, freqTo: 190, durationMs: 70, gain: 0.16, attackMs: 2, releaseMs: 60 }),
      tone({ type: 'square', freqFrom: 950, durationMs: 35, delayMs: 8, gain: 0.08, attackMs: 1, releaseMs: 30 }),
    ],
  },
  poke: {
    id: 'poke',
    group: 'alley',
    label: { vi: 'Chọt lon', en: 'Poke' },
    description: {
      vi: 'Cây chọt trúng lon trong đống phế liệu (ngõ nhặt).',
      en: 'The stick pokes a can out of the pile (alley).',
    },
    volume: 0.35,
    cooldownMs: 110,
    layers: [
      tone({ type: 'square', freqFrom: 2100, durationMs: 26, gain: 0.12, attackMs: 1, releaseMs: 22 }),
      tone({ type: 'triangle', freqFrom: 3250, durationMs: 22, delayMs: 4, gain: 0.07, attackMs: 1, releaseMs: 18 }),
      noise({ durationMs: 18, gain: 0.05, filter: { type: 'highpass', freq: 3000 } }),
    ],
  },
  'sack-drop': {
    id: 'sack-drop',
    group: 'depot',
    label: { vi: 'Thả bao', en: 'Sack drop' },
    description: {
      vi: 'Vứt/buông bao xuống — điểm đổ ở ngõ và sàn kho.',
      en: 'Sack tossed/released — alley drop-off and depot floor.',
    },
    volume: 0.45,
    cooldownMs: 90,
    layers: [
      tone({ type: 'sine', freqFrom: 108, freqTo: 58, durationMs: 170, gain: 0.42, attackMs: 3, releaseMs: 150 }),
      noise({ durationMs: 90, gain: 0.16, attackMs: 4, releaseMs: 80, filter: { type: 'lowpass', freq: 450 } }),
    ],
  },
  'sack-lift': {
    id: 'sack-lift',
    group: 'depot',
    label: { vi: 'Nhấc bao', en: 'Sack lift' },
    description: {
      vi: 'Nhấc bao lên vai ở kho — sột soạt vải.',
      en: 'Sack lifted onto the shoulder at the depot — cloth rustle.',
    },
    volume: 0.35,
    cooldownMs: 90,
    layers: [noise({ durationMs: 190, gain: 0.13, attackMs: 30, releaseMs: 150, filter: { type: 'highpass', freq: 1800 } })],
  },
  'vehicle-turn': {
    id: 'vehicle-turn',
    group: 'route',
    label: { vi: 'Quay đầu', en: 'U-turn' },
    description: {
      vi: 'Xe quay đầu ở cuối làn trên tuyến — rít phanh.',
      en: 'Vehicle U-turns at the lane end on the route — brake squeal.',
    },
    volume: 0.35,
    cooldownMs: 150,
    layers: [
      tone({ type: 'sawtooth', freqFrom: 1150, freqTo: 880, durationMs: 240, gain: 0.1, attackMs: 30, releaseMs: 190 }),
      noise({ durationMs: 200, gain: 0.1, attackMs: 25, releaseMs: 160, filter: { type: 'bandpass', freq: 2600, q: 5 } }),
      tone({ type: 'sine', freqFrom: 75, durationMs: 160, gain: 0.14, attackMs: 20, releaseMs: 140 }),
    ],
  },
  gull: {
    id: 'gull',
    group: 'ambient',
    label: { vi: 'Hải âu', en: 'Gull' },
    description: {
      vi: 'Hải âu kêu trên bãi — thỉnh thoảng mới có.',
      en: 'Gull cries over the yard — only now and then.',
    },
    volume: 0.3,
    cooldownMs: 3000,
    layers: [
      tone({ type: 'sawtooth', freqFrom: 1550, freqTo: 720, durationMs: 170, gain: 0.12, attackMs: 10, releaseMs: 140 }),
      tone({ type: 'sawtooth', freqFrom: 1450, freqTo: 680, durationMs: 150, delayMs: 240, gain: 0.1, attackMs: 8, releaseMs: 130 }),
    ],
  },
  cat: {
    id: 'cat',
    group: 'ambient',
    label: { vi: 'Mèo', en: 'Cat' },
    description: {
      vi: 'Mèo nằm trên đống bao kêu — rất hiếm.',
      en: 'The napping yard cat meows — very rare.',
    },
    volume: 0.3,
    cooldownMs: 3000,
    layers: [
      tone({ type: 'triangle', freqFrom: 540, freqTo: 780, durationMs: 170, gain: 0.14, attackMs: 20, releaseMs: 130 }),
      tone({ type: 'triangle', freqFrom: 780, freqTo: 560, durationMs: 280, delayMs: 165, gain: 0.12, attackMs: 20, releaseMs: 240 }),
    ],
  },
  clang: {
    id: 'clang',
    group: 'recycle',
    label: { vi: 'Búa đập đe', en: 'Anvil clang' },
    description: {
      vi: 'Tiếng búa giáng xuống đe ở xưởng tái chế — một nhịp một tiếng.',
      en: 'Hammer strike on the forge anvil — one beat, one clang.',
    },
    volume: 0.38,
    cooldownMs: 140,
    layers: [
      noise({ durationMs: 90, gain: 0.4, attackMs: 1, releaseMs: 85, filter: { type: 'highpass', freq: 2200 } }),
      tone({ type: 'triangle', freqFrom: 1860, freqTo: 1240, durationMs: 260, gain: 0.22, attackMs: 1, releaseMs: 250 }),
      tone({ type: 'square', freqFrom: 940, freqTo: 720, durationMs: 180, gain: 0.1, attackMs: 1, releaseMs: 170 }),
      tone({ type: 'sine', freqFrom: 260, freqTo: 180, durationMs: 200, gain: 0.16, attackMs: 2, releaseMs: 190 }),
    ],
  },
  thunder: {
    id: 'thunder',
    group: 'ambient',
    label: { vi: 'Sấm', en: 'Thunder' },
    description: {
      vi: 'Sấm nổ khi bão — phát sau chớp một nhịp.',
      en: 'Thunder crack during storms — played one beat after the flash.',
    },
    volume: 0.6,
    cooldownMs: 1200,
    layers: [
      noise({ durationMs: 120, gain: 0.5, attackMs: 1, releaseMs: 110, filter: { type: 'highpass', freq: 900 } }),
      noise({ durationMs: 1800, gain: 0.4, attackMs: 25, releaseMs: 1700, filter: { type: 'lowpass', freq: 220 } }),
      tone({ type: 'sine', freqFrom: 55, freqTo: 32, durationMs: 1400, gain: 0.3, attackMs: 12, releaseMs: 1350 }),
      noise({ durationMs: 600, delayMs: 90, gain: 0.18, attackMs: 50, releaseMs: 520, filter: { type: 'bandpass', freq: 1200, q: 0.8 } }),
    ],
  },
}

export const SOUND_IDS = Object.keys(SOUND_LIBRARY) as SoundId[]

export type LoopId = 'rain' | 'wind'

export interface LoopLayer {
  readonly gain: number
  readonly filter: { readonly type: BiquadFilterType; readonly freq: number; readonly q?: number }
}

export interface LoopSpec {
  readonly id: LoopId
  readonly label: L10n
  readonly description: L10n
  /** Trọng số trộn tối đa khi bed chạy hết cỡ (0..1). */
  readonly volume: number
  readonly layers: readonly LoopLayer[]
}

/**
 * Bed loop phát liên tục theo cường độ (0..1) do lớp thời tiết đẩy vào — không
 * phải one-shot. Cùng quy tắc: mọi con số tinh chỉnh nằm trong bảng này.
 */
export const LOOP_LIBRARY: Record<LoopId, LoopSpec> = {
  rain: {
    id: 'rain',
    label: { vi: 'Mưa rào', en: 'Rain' },
    description: {
      vi: 'Tiếng mưa rào liên tục — to dần theo cường độ mưa.',
      en: 'Continuous rain hiss — louder as the rain intensifies.',
    },
    volume: 0.5,
    layers: [
      { gain: 0.5, filter: { type: 'bandpass', freq: 2400, q: 0.7 } },
      { gain: 0.45, filter: { type: 'lowpass', freq: 480 } },
    ],
  },
  wind: {
    id: 'wind',
    label: { vi: 'Gió', en: 'Wind' },
    description: {
      vi: 'Tiếng gió rít liên tục — mạnh dần theo sức gió.',
      en: 'Continuous wind howl — louder as the wind picks up.',
    },
    volume: 0.4,
    layers: [
      { gain: 0.5, filter: { type: 'lowpass', freq: 420 } },
      { gain: 0.28, filter: { type: 'bandpass', freq: 720, q: 2.5 } },
    ],
  },
}

export const LOOP_IDS = Object.keys(LOOP_LIBRARY) as LoopId[]
