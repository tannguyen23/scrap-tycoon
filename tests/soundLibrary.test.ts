import type { Locale } from '@i18n/types'
import {
  LOOP_IDS,
  LOOP_LIBRARY,
  SOUND_GROUPS,
  SOUND_GROUP_LABELS,
  SOUND_IDS,
  SOUND_LIBRARY,
} from '@ui/sound/library'
import { describe, expect, it } from 'vitest'

const LOCALES: readonly Locale[] = ['vi', 'en']

function audible(freq: number): boolean {
  return freq >= 30 && freq <= 12000
}

describe('sound library', () => {
  it('lists every spec under its own id, grouped and localized', () => {
    expect(SOUND_IDS.length).toBe(Object.keys(SOUND_LIBRARY).length)
    for (const id of SOUND_IDS) {
      const spec = SOUND_LIBRARY[id]
      expect(spec.id).toBe(id)
      expect(SOUND_GROUPS).toContain(spec.group)
      expect(SOUND_GROUP_LABELS[spec.group]).toBeDefined()
      for (const locale of LOCALES) {
        expect(spec.label[locale].length).toBeGreaterThan(0)
        expect(spec.description[locale].length).toBeGreaterThan(0)
      }
    }
  })

  it('covers every group with at least one sound', () => {
    const used = new Set(SOUND_IDS.map((id) => SOUND_LIBRARY[id].group))
    for (const group of SOUND_GROUPS) {
      expect(used.has(group)).toBe(true)
    }
  })

  it('keeps tuning numbers inside sane audio ranges', () => {
    for (const id of SOUND_IDS) {
      const spec = SOUND_LIBRARY[id]
      expect(spec.volume).toBeGreaterThan(0)
      expect(spec.volume).toBeLessThanOrEqual(1)
      expect(spec.cooldownMs).toBeGreaterThanOrEqual(0)
      expect(spec.layers.length).toBeGreaterThan(0)
      for (const layer of spec.layers) {
        expect(layer.durationMs).toBeGreaterThan(0)
        expect(layer.gain).toBeGreaterThan(0)
        expect(layer.gain).toBeLessThanOrEqual(1)
        expect(layer.delayMs ?? 0).toBeGreaterThanOrEqual(0)
        expect(layer.attackMs ?? 0).toBeLessThan(layer.durationMs)
        expect(layer.releaseMs ?? 0).toBeLessThanOrEqual(layer.durationMs)
        if (layer.kind === 'tone') {
          expect(audible(layer.freqFrom)).toBe(true)
          if (layer.freqTo !== undefined) expect(audible(layer.freqTo)).toBe(true)
        } else if (layer.filter) {
          expect(layer.filter.freq).toBeGreaterThan(0)
          expect(layer.filter.freq).toBeLessThan(20000)
        }
      }
    }
  })

  it('keeps the ambience loop beds well-formed too', () => {
    expect(LOOP_IDS.length).toBeGreaterThan(0)
    for (const id of LOOP_IDS) {
      const spec = LOOP_LIBRARY[id]
      expect(spec.id).toBe(id)
      expect(spec.volume).toBeGreaterThan(0)
      expect(spec.volume).toBeLessThanOrEqual(1)
      expect(spec.layers.length).toBeGreaterThan(0)
      for (const locale of LOCALES) {
        expect(spec.label[locale].length).toBeGreaterThan(0)
        expect(spec.description[locale].length).toBeGreaterThan(0)
      }
      for (const layer of spec.layers) {
        expect(layer.gain).toBeGreaterThan(0)
        expect(layer.gain).toBeLessThanOrEqual(1)
        expect(layer.filter.freq).toBeGreaterThan(0)
        expect(layer.filter.freq).toBeLessThan(20000)
      }
    }
  })
})
