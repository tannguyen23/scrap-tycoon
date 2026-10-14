import { CURSOR_PALETTE, CURSOR_SPECS, type CursorKind } from '@ui/cursor'
import { describe, expect, it } from 'vitest'

const KINDS = Object.keys(CURSOR_SPECS) as CursorKind[]

/** Giới hạn con trỏ của Windows: ảnh lớn hơn 32×32 bị bỏ, trình duyệt rơi về con trỏ mặc định. */
const MAX_CURSOR_PX = 32

describe('cursor art', () => {
  it('covers every kind with a rectangular grid inside the OS size limit', () => {
    expect(KINDS.length).toBeGreaterThanOrEqual(4)
    for (const kind of KINDS) {
      const spec = CURSOR_SPECS[kind]
      const width = spec.grid[0]?.length ?? 0
      expect(width).toBeGreaterThanOrEqual(8)
      expect(spec.grid.length).toBeGreaterThanOrEqual(8)
      for (const row of spec.grid) {
        expect(row.length).toBe(width)
      }
      expect(spec.scale).toBeGreaterThanOrEqual(1)
      expect(width * spec.scale).toBeLessThanOrEqual(MAX_CURSOR_PX)
      expect(spec.grid.length * spec.scale).toBeLessThanOrEqual(MAX_CURSOR_PX)
    }
  })

  it('draws only palette colours (or transparency) and anchors hotspots on drawn pixels', () => {
    for (const kind of KINDS) {
      const spec = CURSOR_SPECS[kind]
      let drawn = 0
      for (const row of spec.grid) {
        for (const char of row) {
          if (char === '.') continue
          expect(CURSOR_PALETTE[char], `kí tự lạ "${char}" trong ${kind}`).toBeDefined()
          drawn += 1
        }
      }
      expect(drawn).toBeGreaterThan(0)

      const row = spec.grid[spec.hotspot.y]
      const char = row?.[spec.hotspot.x]
      expect(char, `hotspot của ${kind} nằm ngoài lưới`).toBeDefined()
      expect(char, `hotspot của ${kind} rơi vào ô trong suốt`).not.toBe('.')
    }
  })

  it('keeps one valid palette shared by every cursor', () => {
    expect(Object.keys(CURSOR_PALETTE).length).toBeGreaterThanOrEqual(3)
    for (const [char, color] of Object.entries(CURSOR_PALETTE)) {
      expect(char.length).toBe(1)
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(CURSOR_PALETTE['.']).toBeUndefined()
  })
})
