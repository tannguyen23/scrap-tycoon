import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawProp, propBase, type ZoneProp } from '@ui/scene/focus/props'

/**
 * Khoá "đế chặn khớp với art": hộp đế của mỗi loại vật phải NẰM TRONG vùng nó vẽ ra —
 * chặn ở chỗ không có gì là lỗi vô hình (người chơi đâm vào khoảng không), còn để đế thò
 * ra ngoài art thì nó không còn là "chân" của vật nữa.
 *
 * Cùng kiểu khoá với `tests/decorItems.test.ts` cho decor tầng map: khung bao là hợp
 * đồng — sửa art thì phải sửa khung theo. Hộp bao đọc bằng `getBounds()` trên chính
 * `Graphics` mà `drawProp` vẽ ra (mẹo `tests/scenePack.test.ts` vẫn dùng).
 */

/** Mỗi loại một mẫu — `variant` là cỡ/kiểu (xem `props.ts`), chọn mẫu TO NHẤT mỗi loại. */
const SAMPLES: readonly { what: string; prop: ZoneProp }[] = [
  { what: 'đống phế liệu nhỏ nhất', prop: { kind: 'heap', x: 100, y: 100, variant: 3 } },
  { what: 'đống phế liệu to nhất', prop: { kind: 'heap', x: 100, y: 100, variant: 8 } },
  { what: 'thùng phuy', prop: { kind: 'drum', x: 100, y: 100, variant: 1 } },
  { what: 'tủ lạnh', prop: { kind: 'fridge', x: 100, y: 100 } },
  { what: 'máy giặt', prop: { kind: 'washer', x: 100, y: 100 } },
  { what: 'thùng rác công nghiệp', prop: { kind: 'dumpster', x: 100, y: 100 } },
  { what: 'thùng gỗ', prop: { kind: 'crate', x: 100, y: 100 } },
  { what: 'chồng lốp 5 tầng', prop: { kind: 'tireStack', x: 100, y: 100, variant: 5 } },
  { what: 'lốp dựng tựa', prop: { kind: 'leaningTire', x: 100, y: 100 } },
  { what: 'tấm tôn dựng nghiêng', prop: { kind: 'leaningSheet', x: 100, y: 100 } },
  { what: 'thùng nhựa xanh (nắp mở)', prop: { kind: 'greenBin', x: 100, y: 100, variant: 1 } },
  { what: 'TV vỡ', prop: { kind: 'brokenTv', x: 100, y: 100 } },
]

describe('zone prop bases', () => {
  for (const sample of SAMPLES) {
    it(`${sample.what}: hộp đế nằm trong vùng art vẽ ra`, () => {
      const art = new Graphics()
      drawProp(art, sample.prop)
      const box = art.getBounds()
      expect(box.width, `${sample.what} chưa vẽ gì`).toBeGreaterThan(0)
      const minX = box.x
      const minY = box.y
      const maxX = box.x + box.width
      const maxY = box.y + box.height

      const base = propBase(sample.prop)
      // 1px dung sai: pixel art làm tròn ở vài mép.
      expect(base.x, 'đế thò ra ngoài art (tây)').toBeGreaterThanOrEqual(minX - 1)
      expect(base.x + base.width, 'đế thò ra ngoài art (đông)').toBeLessThanOrEqual(maxX + 1)
      expect(base.y, 'đế vươn cao hơn art').toBeGreaterThanOrEqual(minY - 1)
      expect(base.y + base.height, 'đế thò ra ngoài art (nam)').toBeLessThanOrEqual(maxY + 1)
      // Và đế phải dày dặn: hộp vài px là vật không chặn được ai.
      expect(base.width, 'đế quá hẹp').toBeGreaterThanOrEqual(8)
      expect(base.height, 'đế quá thấp').toBeGreaterThanOrEqual(8)
    })
  }
})
