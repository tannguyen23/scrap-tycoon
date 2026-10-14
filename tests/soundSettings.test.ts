import { DEFAULT_SOUND_SETTINGS, SoundStore } from '@ui/sound/settings'
import { describe, expect, it } from 'vitest'

describe('sound settings store', () => {
  it('starts from the defaults and notifies only on real changes', () => {
    const store = new SoundStore()
    expect(store.get()).toEqual(DEFAULT_SOUND_SETTINGS)

    let notified = 0
    const unsubscribe = store.subscribe(() => {
      notified += 1
    })

    store.set({ muted: true })
    expect(store.get().muted).toBe(true)
    expect(notified).toBe(1)

    store.set({ muted: true })
    expect(notified).toBe(1)

    store.set({ volume: 0.4 })
    expect(store.get()).toEqual({ volume: 0.4, muted: true })
    expect(notified).toBe(2)

    unsubscribe()
    store.set({ volume: 0.9 })
    expect(notified).toBe(2)
  })

  it('clamps volume into 0..1', () => {
    const store = new SoundStore()
    store.set({ volume: 5 })
    expect(store.get().volume).toBe(1)
    store.set({ volume: -2 })
    expect(store.get().volume).toBe(0)
  })
})
