import { LOOP_LIBRARY, SOUND_LIBRARY, type LoopId, type SoundId, type SoundLayer } from './library'
import { DEFAULT_SOUND_SETTINGS, type SoundSettings } from './settings'

/** Khoảng lặng thêm sau đuôi envelope trước khi nguồn bị ngắt hẳn. */
const TAIL_SECONDS = 0.05
/** Buffer nhiễu trắng tạo một lần cho mỗi context rồi dùng lại cho mọi layer. */
const NOISE_SECONDS = 1
/** Độ trễ nhỏ để node schedule không bao giờ rơi vào quá khứ. */
const START_OFFSET = 0.01
/** Ramp mềm khi đổi mức bed loop (giây) — vào nhanh hơn khi tắt. */
const LOOP_RAMP_SECONDS = 0.35

export interface SoundPlayerOptions {
  /** Điểm tiêm cho test; đường chạy thật tạo AudioContext của trình duyệt. */
  createContext?: () => AudioContext | null
  now?: () => number
}

function defaultCreateContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  return new AudioContext()
}

function masterTarget(settings: SoundSettings): number {
  return settings.muted ? 0 : settings.volume * settings.volume
}

function shapeEnvelope(
  param: AudioParam,
  start: number,
  duration: number,
  peak: number,
  attackMs: number,
  releaseMs: number,
): void {
  const attack = Math.min(attackMs / 1000, duration * 0.9)
  const release = Math.min(Math.max(releaseMs / 1000, 0.001), duration - attack)
  param.setValueAtTime(0, start)
  param.linearRampToValueAtTime(peak, start + attack)
  param.setValueAtTime(peak, start + duration - release)
  param.exponentialRampToValueAtTime(peak * 0.005, start + duration)
}

/**
 * Bộ phát âm thanh tổng hợp bằng Web Audio. Không tạo gì lúc import (test node
 * import được), chỉ schedule khi context đang chạy — trình duyệt chỉ mở khoá
 * audio từ gesture đầu tiên nên `installAudioUnlock()` lo việc đó.
 */
export class SoundPlayer {
  private readonly createContext: () => AudioContext | null
  private readonly now: () => number
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private settings: SoundSettings = DEFAULT_SOUND_SETTINGS
  private readonly lastPlayed = new Map<SoundId, number>()
  /** Mức mong muốn của từng bed loop — ghi nhớ để áp khi context sẵn sàng. */
  private readonly loopLevels = new Map<LoopId, number>()
  private readonly loops = new Map<LoopId, GainNode>()

  constructor(options: SoundPlayerOptions = {}) {
    this.createContext = options.createContext ?? defaultCreateContext
    this.now = options.now ?? (() => performance.now())
  }

  play(id: SoundId): boolean {
    const spec = SOUND_LIBRARY[id]
    const context = this.ensureContext()
    if (!context || !this.master || context.state !== 'running') {
      if (context && context.state === 'suspended') void context.resume().catch(() => {})
      return false
    }

    const at = this.now()
    const last = this.lastPlayed.get(id)
    if (last !== undefined && at - last < spec.cooldownMs) return false
    this.lastPlayed.set(id, at)

    const start = context.currentTime + START_OFFSET
    for (const layer of spec.layers) {
      this.scheduleLayer(context, this.master, layer, start, spec.volume)
    }
    return true
  }

  setMaster(settings: SoundSettings): void {
    this.settings = settings
    const context = this.context
    if (!context || !this.master) return
    this.master.gain.setTargetAtTime(masterTarget(settings), context.currentTime, 0.02)
  }

  /**
   * Mức 0..1 của một bed loop (mưa, gió). Có thể gọi trước khi audio được mở khoá:
   * mức được ghi nhớ và áp ngay khi context chạy.
   */
  setLoop(id: LoopId, level: number): void {
    const clamped = Math.min(1, Math.max(0, level))
    const previous = this.loopLevels.get(id)
    if (previous === clamped && this.loops.has(id)) return
    this.loopLevels.set(id, clamped)
    this.applyLoops()
  }

  /** Tạo + resume context từ một user gesture (trình duyệt chặn autoplay). */
  unlock(): void {
    const context = this.ensureContext()
    if (context && context.state === 'suspended') void context.resume().catch(() => {})
    this.applyLoops()
  }

  dispose(): void {
    void this.context?.close().catch(() => {})
    this.context = null
    this.master = null
    this.noise = null
    this.lastPlayed.clear()
    this.loops.clear()
    this.loopLevels.clear()
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context
    const context = this.createContext()
    if (!context) return null
    const master = context.createGain()
    master.gain.value = masterTarget(this.settings)
    master.connect(context.destination)
    this.context = context
    this.master = master
    return context
  }

  /** Đồng bộ node loop với mức mong muốn (tạo node lazily khi cần tiếng). */
  private applyLoops(): void {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    for (const [id, level] of this.loopLevels) {
      if (level <= 0) continue
      let gain = this.loops.get(id)
      if (!gain) {
        gain = this.createLoop(context, master, id)
        this.loops.set(id, gain)
      }
      gain.gain.setTargetAtTime(level * LOOP_LIBRARY[id].volume, context.currentTime, LOOP_RAMP_SECONDS)
    }
  }

  private createLoop(context: AudioContext, master: GainNode, id: LoopId): GainNode {
    const spec = LOOP_LIBRARY[id]
    const gain = context.createGain()
    gain.gain.value = 0
    gain.connect(master)
    for (const layer of spec.layers) {
      const source = context.createBufferSource()
      source.buffer = this.noiseBuffer(context)
      source.loop = true
      const filter = context.createBiquadFilter()
      filter.type = layer.filter.type
      filter.frequency.value = layer.filter.freq
      if (layer.filter.q !== undefined) filter.Q.value = layer.filter.q
      const layerGain = context.createGain()
      layerGain.gain.value = layer.gain
      source.connect(filter)
      filter.connect(layerGain)
      layerGain.connect(gain)
      source.start()
    }
    return gain
  }

  private scheduleLayer(
    context: AudioContext,
    master: GainNode,
    layer: SoundLayer,
    start: number,
    volume: number,
  ): void {
    const duration = layer.durationMs / 1000
    const at = start + (layer.delayMs ?? 0) / 1000
    const gain = context.createGain()
    shapeEnvelope(
      gain.gain,
      at,
      duration,
      layer.gain * volume,
      layer.attackMs ?? 4,
      layer.releaseMs ?? layer.durationMs * 0.6,
    )

    if (layer.kind === 'tone') {
      const osc = context.createOscillator()
      osc.type = layer.type
      osc.frequency.setValueAtTime(layer.freqFrom, at)
      if (layer.freqTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(layer.freqTo, at + duration)
      }
      osc.connect(gain)
      osc.start(at)
      osc.stop(at + duration + TAIL_SECONDS)
    } else {
      const source = context.createBufferSource()
      source.buffer = this.noiseBuffer(context)
      let tail: AudioNode = source
      if (layer.filter) {
        const filter = context.createBiquadFilter()
        filter.type = layer.filter.type
        filter.frequency.setValueAtTime(layer.filter.freq, at)
        if (layer.filter.q !== undefined) filter.Q.setValueAtTime(layer.filter.q, at)
        source.connect(filter)
        tail = filter
      }
      tail.connect(gain)
      source.start(at)
      source.stop(at + duration + TAIL_SECONDS)
    }
    gain.connect(master)
  }

  private noiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noise) return this.noise
    const length = Math.floor(context.sampleRate * NOISE_SECONDS)
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    // Trộn đuôi vào đầu buffer để bed loop không "tách" một tiếng mỗi vòng.
    const blend = Math.min(Math.floor(context.sampleRate * 0.05), Math.floor(length / 4))
    for (let i = 0; i < blend; i++) {
      const index = length - blend + i
      const k = i / blend
      const tail = data[index] ?? 0
      const head = data[i] ?? 0
      data[index] = tail * (1 - k) + head * k
    }
    this.noise = buffer
    return buffer
  }
}

/** Một player duy nhất cho cả game lẫn asset studio. */
export const sound = new SoundPlayer()

/** Gọi ở mọi điểm kích hoạt: phát rồi quên. */
export function playSound(id: SoundId): boolean {
  return sound.play(id)
}

let unlockInstalled = false

/**
 * Trình duyệt chỉ cho AudioContext chạy sau gesture đầu tiên; game không có màn
 * hình start nên gắn listener một lần ở capture — pointerdown chạy trước click,
 * nên tiếng của chính click đầu tiên vẫn kịp kêu.
 */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof document === 'undefined') return
  unlockInstalled = true
  const unlock = (): void => sound.unlock()
  document.addEventListener('pointerdown', unlock, { capture: true, once: true })
  document.addEventListener('keydown', unlock, { capture: true, once: true })
}
