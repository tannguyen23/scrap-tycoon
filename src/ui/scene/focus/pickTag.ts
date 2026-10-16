import { Container, Graphics } from 'pixi.js'
import type { Spot } from '@scene/core/types'
import { WORK_KEY } from '@ui/workKey'

/**
 * Chữ pixel 4×8 (`1` = một ô 1px), chân chữ ở hàng cuối. Chữ không dấu chiếm 6
 * hàng dưới; chữ có dấu (Ữ) dùng 2 hàng trên cho dấu ngã + dấu móc. Mỗi chữ một
 * "glyph", và chữ nào dùng thì phải có ở đây (test khoá) — chữ là art, không phải
 * font của hệ thống, nên thiếu glyph là vẽ ra khoảng trống.
 */
export const PIXEL_GLYPHS: Record<string, readonly string[]> = {
  H: ['0000', '0000', '1001', '1001', '1111', '1001', '1001', '1001'],
  O: ['0000', '0000', '0110', '1001', '1001', '1001', '1001', '0110'],
  L: ['0000', '0000', '1000', '1000', '1000', '1000', '1000', '1111'],
  D: ['0000', '0000', '1110', '1001', '1001', '1001', '1001', '1110'],
  F: ['0000', '0000', '1111', '1000', '1110', '1000', '1000', '1000'],
  G: ['0000', '0000', '0110', '1001', '1000', '1011', '1001', '0110'],
  I: ['0000', '0000', '1111', '0110', '0110', '0110', '0110', '1111'],
  U: ['0000', '0000', '1001', '1001', '1001', '1001', '1001', '0110'],
  'Ữ': ['0110', '0001', '1001', '1001', '1001', '1001', '1001', '0110'],
}

const LETTER_WIDTH = 4
const LETTER_STEP = 5
/** Phím cuối dòng: 12×12 kể cả viền 1px. */
const CAP = 12
/** Khe giữa chữ và phím. */
const CAP_GAP = 6
/** Lề trong của tấm nền. */
const PAD = 3
/** Hàng đầu của chữ so với tâm dấu hiệu (chân chữ trùng mép trong dưới của phím). */
const LETTER_TOP = -3
/** Khoảng cách giữa tâm phím và điểm món. */
const TAG_LIFT = 16

/** Khung khai báo tối đa của dấu hiệu: tấm nền 44×18 + mũi nhọn 3px. */
export const PICK_TAG_BOX = { width: 44, height: 21 } as const

const PLATE = 0x2c2116
const LETTER_INK = 0xf3e7c2
const KEY_FACE = 0xf3e7c2
const KEY_LIGHT = 0xfff8de
const KEY_DARK = 0x33261a

/** Nhấp nhô nhẹ — dấu hiệu động thì mắt bắt được ngay. */
const BOB_AMPLITUDE = 1.5
const BOB_SPEED = 2.6

export interface PickTag {
  readonly container: Container
  /**
   * Treo dấu hiệu lên món (mỗi lần feed đẩy tới), hoặc `null` để ẩn. `word` là chữ
   * đứng trước phím, đã dịch sẵn ở feed ("GIỮ" / "HOLD").
   */
  set(target: Spot | null, word: string): void
  update(dt: number, elapsed: number): void
}

/**
 * "<word> F" vẽ pixel treo NGAY TẠI mẩu sắt đang trong tầm — dấu hiệu duy nhất cho
 * biết món nào nhặt được (HUD chỉ còn thanh tiến trình). Món rời chỉ 4px, cùng tông
 * với sàn nên đi ngang rất dễ lẫn vào vụn nền; tấm nền tối + chữ sáng + mũi nhọn
 * chúc xuống món là thứ mắt bắt được. Toàn bộ là `Graphics` + lưới bit (không dùng
 * `Text`): chữ vẽ sẵn bị phóng theo zoom là nhoè, đã bị báo một lần.
 */
export function createPickTag(): PickTag {
  const container = new Container()
  const plate = new Graphics()
  container.addChild(plate)
  container.visible = false
  let shownWord: string | null = null
  let baseY = 0

  return {
    container,
    set: (target, word) => {
      if (!target) {
        container.visible = false
        return
      }
      if (word !== shownWord) {
        plate.clear()
        drawHoldTag(plate, 0, 0, WORK_KEY, word)
        shownWord = word
      }
      baseY = target.y - TAG_LIFT
      container.position.set(Math.round(target.x), Math.round(baseY))
      container.visible = true
    },
    update: (_dt, elapsed) => {
      if (!container.visible) return
      container.y = Math.round(baseY + Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE)
    },
  }
}

/**
 * Vẽ "<word>" + phím lên một tấm nền tối, kèm mũi nhọn chỉ xuống món; tâm ở (x, y).
 * Mọi toạ độ đều nguyên theo lưới 1px nên không bao giờ nhoè ở nấc zoom nguyên.
 */
export function drawHoldTag(g: Graphics, x: number, y: number, key: string, word: string): void {
  const capGlyph = PIXEL_GLYPHS[key]
  if (!capGlyph) return
  const wordWidth = word.length > 0 ? word.length * LETTER_WIDTH + (word.length - 1) : 0
  const content = wordWidth + CAP_GAP + CAP
  const halfWidth = Math.ceil(content / 2) + PAD
  const halfHeight = CAP / 2 + PAD
  const left = x - Math.floor(content / 2)
  // Mũi nhọn vẽ trước để tấm nền phủ mép trên của nó.
  g.moveTo(x - 3, y + halfHeight - 1)
    .lineTo(x + 3, y + halfHeight - 1)
    .lineTo(x, y + halfHeight + 2)
    .closePath()
    .fill(PLATE)
  g.rect(x - halfWidth, y - halfHeight, halfWidth * 2, halfHeight * 2).fill(PLATE)
  const letterTop = y + LETTER_TOP
  for (let index = 0; index < word.length; index++) {
    const rows = PIXEL_GLYPHS[word[index] ?? '']
    if (rows) drawGlyph(g, left + index * LETTER_STEP, letterTop, rows, LETTER_INK)
  }
  const capX = left + wordWidth + CAP_GAP
  g.rect(capX, y - CAP / 2, CAP, CAP).fill(KEY_DARK)
  g.rect(capX + 1, y - CAP / 2 + 1, CAP - 2, CAP - 2).fill(KEY_FACE)
  g.rect(capX + 1, y - CAP / 2 + 1, CAP - 2, 2).fill(KEY_LIGHT)
  drawGlyph(g, capX + (CAP - LETTER_WIDTH) / 2, letterTop, capGlyph, KEY_DARK)
}

/** Một ô vuông 1px cho mỗi bit `1` — chữ là hình học, không phải texture chữ. */
function drawGlyph(
  g: Graphics,
  x: number,
  y: number,
  rows: readonly string[],
  color: number,
): void {
  for (let row = 0; row < rows.length; row++) {
    const bits = rows[row] ?? ''
    for (let col = 0; col < bits.length; col++) {
      if (bits[col] !== '1') continue
      g.rect(x + col, y + row, 1, 1).fill(color)
    }
  }
}
