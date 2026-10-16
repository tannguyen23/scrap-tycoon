import { Graphics } from 'pixi.js'
import { createPickTag, drawHoldTag, PICK_TAG_BOX, PIXEL_GLYPHS } from '@ui/scene/focus/pickTag'
import { WORK_KEY } from '@ui/workKey'
import { describe, expect, it } from 'vitest'

/**
 * Dấu hiệu "nhặt được" treo tại món: chữ "HOLD" + phím F vẽ pixel trên tấm nền tối.
 * Test khoá bốn thứ dễ hỏng — vị trí nhấc lên (mũi nhọn không đè lên món), nhấp nhô
 * không trôi, art nằm trong khung khai báo, và glyph phải có cho đúng chữ/phím dùng.
 */
describe('pick-up tag', () => {
  it('stays hidden until a piece is in reach, then hangs above it', () => {
    const tag = createPickTag()
    expect(tag.container.visible).toBe(false)
    tag.set({ x: 200, y: 180 }, 'GIỮ')
    expect(tag.container.visible).toBe(true)
    expect(tag.container.position.x).toBe(200)
    // Nhấc lên khỏi điểm món (TAG_LIFT = 16), mũi nhọn chúc xuống mẩu sắt.
    expect(tag.container.position.y).toBe(164)
    tag.set(null, 'GIỮ')
    expect(tag.container.visible).toBe(false)
  })

  it('keeps bobbing around the piece and never drifts far from it', () => {
    const tag = createPickTag()
    tag.set({ x: 100, y: 100 }, 'GIỮ')
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (let t = 0; t < 6; t += 0.05) {
      tag.update(0.05, t)
      const y = tag.container.position.y
      min = Math.min(min, y)
      max = Math.max(max, y)
    }
    // Nhấp nhô quanh mốc 84 (100 − 16) chứ không trôi khỏi món.
    expect(min).toBeGreaterThanOrEqual(82)
    expect(max).toBeLessThanOrEqual(86)
  })

  it('draws the whole sign inside the declared box, on the pixel grid', () => {
    const g = new Graphics()
    drawHoldTag(g, 0, 0, WORK_KEY, 'GIỮ')
    const box = g.getBounds()
    expect(box.width, 'dấu hiệu chưa vẽ gì').toBeGreaterThan(0)
    // Khung khai báo là hợp đồng: vẽ to hơn là dấu hiệu bắt đầu che bãi.
    expect(box.width).toBeLessThanOrEqual(PICK_TAG_BOX.width)
    expect(box.height).toBeLessThanOrEqual(PICK_TAG_BOX.height)
    expect(box.width).toBeGreaterThanOrEqual(PICK_TAG_BOX.width - 6)
    // Toạ độ phải nguyên (lưới 1px) — lệch nửa ô là nhoè ở nấc zoom nguyên.
    expect(Number.isInteger(box.x)).toBe(true)
    expect(Number.isInteger(box.y)).toBe(true)
    expect(Number.isInteger(box.width)).toBe(true)
    expect(Number.isInteger(box.height)).toBe(true)
  })

  it('has pixel glyphs for every letter both wordings need', () => {
    // Đổi `WORK_KEY` hay chữ trong `UI.holdWord` mà quên glyph thì dấu hiệu vẽ ra
    // khoảng trống — chữ ở đây là art, không có gì tự báo lỗi ngoài test này.
    expect(PIXEL_GLYPHS[WORK_KEY], `thiếu glyph cho phím "${WORK_KEY}"`).toBeDefined()
    for (const letter of 'HOLDGIỮ') {
      expect(PIXEL_GLYPHS[letter], `thiếu glyph cho chữ "${letter}"`).toBeDefined()
    }
  })
})
