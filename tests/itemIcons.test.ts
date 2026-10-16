import { GAME_CONTENT } from '@content/index'
import { GEAR_ICONS, ICON_PALETTE, ITEM_ICONS } from '@ui/itemIcons'
import { describe, expect, it } from 'vitest'

/** Shared art invariants: rectangular grid, palette-only, contact shadow at the bottom. */
function expectIconGrid(id: string, grid: readonly string[]): void {
  const width = grid[0]?.length ?? 0
  expect(width, id).toBeGreaterThanOrEqual(8)
  expect(grid.length, id).toBeGreaterThanOrEqual(8)
  let drawn = 0
  for (const row of grid) {
    expect(row.length, `hàng lệch trong "${id}"`).toBe(width)
    for (const char of row) {
      if (char === '.') continue
      expect(ICON_PALETTE[char], `kí tự lạ "${char}" trong ${id}`).toBeDefined()
      drawn += 1
    }
  }
  expect(drawn, `${id} không vẽ gì`).toBeGreaterThan(20)
  // Bước 1 của công thức khối: hàng vẽ cuối cùng phải là BÓNG TIẾP XÚC (`K`) —
  // thiếu nó thì icon đọc ra vật bay lơ lửng giữa ô.
  const lowest = [...grid].reverse().find((row) => /[^.]/.test(row)) ?? ''
  expect(lowest, `${id} thiếu bóng tiếp xúc ở đáy`).toContain('K')
}

function silhouette(grid: readonly string[]): string {
  return grid.map((row) => row.replaceAll(/[^.]/g, '#')).join('\n')
}

describe('item icons', () => {
  it('covers every item that can go in the bag', () => {
    const carryable = Object.values(GAME_CONTENT.items).filter(
      (item) => item.carry && item.id !== GAME_CONTENT.currencyItemId,
    )
    expect(carryable.length).toBeGreaterThan(0)
    for (const item of carryable) {
      expect(ITEM_ICONS[item.id], `thiếu icon cho "${item.id}"`).toBeDefined()
    }
  })

  it('covers every piece of gear content declares', () => {
    const pieces = GAME_CONTENT.gear ?? []
    expect(pieces.length).toBeGreaterThan(0)
    for (const piece of pieces) {
      expect(GEAR_ICONS[piece.id], `thiếu icon cho trang bị "${piece.id}"`).toBeDefined()
    }
  })

  it('draws rectangular grids using only palette characters', () => {
    for (const [id, grid] of Object.entries(ITEM_ICONS)) expectIconGrid(id, grid)
    for (const [id, grid] of Object.entries(GEAR_ICONS)) expectIconGrid(id, grid)
  })

  it('keeps the silhouettes distinct', () => {
    const seen = new Map<string, string>()
    const all = { ...ITEM_ICONS, ...GEAR_ICONS }
    for (const [id, grid] of Object.entries(all)) {
      const shape = silhouette(grid)
      const clash = seen.get(shape)
      expect(clash, `"${id}" dùng lại silhouette của "${clash}"`).toBeUndefined()
      seen.set(shape, id)
    }
  })

  it('keeps one valid palette shared by every icon', () => {
    expect(Object.keys(ICON_PALETTE).length).toBeGreaterThanOrEqual(6)
    for (const [char, color] of Object.entries(ICON_PALETTE)) {
      expect(char.length).toBe(1)
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(ICON_PALETTE['.']).toBeUndefined()
  })
})
