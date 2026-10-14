export interface SoundSettings {
  readonly volume: number
  readonly muted: boolean
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { volume: 0.7, muted: false }

/**
 * Pure observable cho âm lượng/tắt tiếng (pattern của ThemeStore). Việc lưu vào
 * storage và áp vào player do tầng app làm lúc boot.
 */
export class SoundStore {
  private settings: SoundSettings
  private readonly listeners = new Set<() => void>()

  constructor(initial: SoundSettings = DEFAULT_SOUND_SETTINGS) {
    this.settings = initial
  }

  get = (): SoundSettings => this.settings

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  set = (patch: Partial<SoundSettings>): void => {
    const volume = clamp01(patch.volume ?? this.settings.volume)
    const muted = patch.muted ?? this.settings.muted
    if (volume === this.settings.volume && muted === this.settings.muted) return
    this.settings = { volume, muted }
    for (const listener of this.listeners) listener()
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
