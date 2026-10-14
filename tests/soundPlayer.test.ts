import { LOOP_LIBRARY, SOUND_LIBRARY } from '@ui/sound/library'
import { SoundPlayer } from '@ui/sound/player'
import { describe, expect, it } from 'vitest'

/** Minimal Web Audio stand-in — enough surface for the player's node graph. */
class FakeParam {
  value = 0
  setValueAtTime(value: number): void {
    this.value = value
  }
  linearRampToValueAtTime(value: number): void {
    this.value = value
  }
  exponentialRampToValueAtTime(value: number): void {
    this.value = value
  }
  setTargetAtTime(value: number): void {
    this.value = value
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = []
  connect(target: FakeNode): void {
    this.outputs.push(target)
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam()
}

class FakeOscillator extends FakeNode {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeParam()
  startedAt = 0
  stoppedAt = 0
  start(at: number): void {
    this.startedAt = at
  }
  stop(at: number): void {
    this.stoppedAt = at
  }
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null
  loop = false
  startedAt = 0
  stoppedAt = 0
  start(at = 0): void {
    this.startedAt = at
  }
  stop(at: number): void {
    this.stoppedAt = at
  }
}

class FakeFilter extends FakeNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeParam()
  readonly Q = new FakeParam()
}

class FakeContext {
  state: AudioContextState = 'running'
  currentTime = 0
  sampleRate = 48000
  readonly destination = new FakeNode()
  readonly gains: FakeGain[] = []
  readonly oscillators: FakeOscillator[] = []
  readonly sources: FakeBufferSource[] = []
  resumeCalls = 0

  createGain(): FakeGain {
    const node = new FakeGain()
    this.gains.push(node)
    return node
  }
  createOscillator(): FakeOscillator {
    const node = new FakeOscillator()
    this.oscillators.push(node)
    return node
  }
  createBufferSource(): FakeBufferSource {
    const node = new FakeBufferSource()
    this.sources.push(node)
    return node
  }
  createBiquadFilter(): FakeFilter {
    return new FakeFilter()
  }
  createBuffer(_channels: number, length: number): { getChannelData(): Float32Array } {
    return { getChannelData: () => new Float32Array(length) }
  }
  resume(): Promise<void> {
    this.resumeCalls += 1
    this.state = 'running'
    return Promise.resolve()
  }
  close(): Promise<void> {
    this.state = 'closed'
    return Promise.resolve()
  }
}

function fakePlayer(context: FakeContext | null, now?: () => number): SoundPlayer {
  return new SoundPlayer({
    createContext: () => context as unknown as AudioContext | null,
    now,
  })
}

function countLayers(id: keyof typeof SOUND_LIBRARY, kind: 'tone' | 'noise'): number {
  return SOUND_LIBRARY[id].layers.filter((layer) => layer.kind === kind).length
}

describe('sound player', () => {
  it('stays silent without an AudioContext (node)', () => {
    const player = fakePlayer(null)
    expect(player.play('buy')).toBe(false)
    expect(() => player.setMaster({ volume: 0.5, muted: false })).not.toThrow()
    expect(() => player.unlock()).not.toThrow()
    expect(() => player.dispose()).not.toThrow()
  })

  it('applies the per-sound cooldown to repeated plays', () => {
    const context = new FakeContext()
    let clock = 1000
    const player = fakePlayer(context, () => clock)

    expect(player.play('buy')).toBe(true)
    expect(player.play('buy')).toBe(false)
    clock += SOUND_LIBRARY.buy.cooldownMs
    expect(player.play('buy')).toBe(true)
  })

  it('holds back while the context is suspended and resumes on unlock', () => {
    const context = new FakeContext()
    context.state = 'suspended'
    const player = fakePlayer(context)

    expect(player.play('click')).toBe(false)
    expect(context.resumeCalls).toBe(1)
    expect(player.play('click')).toBe(true)
  })

  it('schedules one node per layer and follows the master settings', () => {
    const context = new FakeContext()
    const player = fakePlayer(context)

    expect(player.play('buy')).toBe(true)
    expect(context.oscillators.length).toBe(countLayers('buy', 'tone'))

    const master = context.gains[0]
    expect(master).toBeDefined()
    expect(master?.outputs.length).toBe(1)
    expect(master?.outputs[0]).toBe(context.destination)
    expect(master?.gain.value).toBeCloseTo(0.7 * 0.7)

    player.setMaster({ volume: 0.5, muted: false })
    expect(master?.gain.value).toBeCloseTo(0.25)

    player.setMaster({ volume: 0.5, muted: true })
    expect(master?.gain.value).toBe(0)
  })

  it('builds a noise source for noise layers', () => {
    const context = new FakeContext()
    const player = fakePlayer(context)

    expect(player.play('sack-drop')).toBe(true)
    expect(context.sources.length).toBe(countLayers('sack-drop', 'noise'))
    expect(context.oscillators.length).toBe(countLayers('sack-drop', 'tone'))
  })

  it('creates each ambience bed once and ramps its level', () => {
    const context = new FakeContext()
    const player = fakePlayer(context)

    // Chưa có context: mức được ghi nhớ chứ chưa tạo node.
    player.setLoop('rain', 0.5)
    expect(context.sources.length).toBe(0)

    player.unlock()
    expect(context.sources.length).toBe(LOOP_LIBRARY.rain.layers.length)
    expect(context.sources.every((source) => source.loop)).toBe(true)

    const master = context.gains[0]
    const rainGain = context.gains[1]
    expect(rainGain?.outputs[0]).toBe(master)
    expect(rainGain?.gain.value).toBeCloseTo(0.5 * LOOP_LIBRARY.rain.volume)

    player.setLoop('rain', 1.5)
    player.setLoop('rain', 1)
    expect(rainGain?.gain.value).toBeCloseTo(LOOP_LIBRARY.rain.volume)
    expect(context.sources.length).toBe(LOOP_LIBRARY.rain.layers.length)

    player.setLoop('wind', 0.25)
    expect(context.sources.length).toBe(
      LOOP_LIBRARY.rain.layers.length + LOOP_LIBRARY.wind.layers.length,
    )
  })

  it('stays silent without a context even for loops', () => {
    const player = fakePlayer(null)
    expect(() => player.setLoop('wind', 0.5)).not.toThrow()
    expect(() => player.setLoop('wind', 0)).not.toThrow()
    expect(() => player.unlock()).not.toThrow()
    expect(() => player.dispose()).not.toThrow()
  })
})
