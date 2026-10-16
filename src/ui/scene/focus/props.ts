import type { Graphics } from 'pixi.js'
import type { Rect } from '@ground/core/metrics'
import {
  HEAP_HALF_WIDTH,
  HEAP_HEIGHT,
  drawBrokenTv,
  drawCrate,
  drawDrum,
  drawDumpster,
  drawFridge,
  drawGreenBin,
  drawJunkHeap,
  drawLeaningSheet,
  drawLeaningTire,
  drawTireStack,
  drawWasher,
} from './alley/sprites'

/**
 * Vật ĐỨNG trong khu, khai một lần cho cả art lẫn va chạm.
 *
 * Mỗi khu export một `ZONE_PROPS` (toạ độ LOCAL của khu, `y` = đường chân như `depthArt`);
 * scene vẽ đúng danh sách đó qua `drawProp`, còn `walkable` dựng đế chặn từ chính danh
 * sách ấy — nên không có chuyện art một chỗ, va chạm một nẻo.
 *
 * **Vật NẰM thì không khai** (lốp nằm, pallet nằm, thùng đổ nghiêng, bao vứt lẻ, chai,
 * cụm cỏ, decal): bước qua được, đó là chủ ý — nếu khai hết thì bãi rác thành mê cung.
 */

const DRUM_TONES = [
  { base: 0x5d8a74, lit: 0x7aa884 },
  { base: 0x5a6a8a, lit: 0x78899f },
  { base: 0x9c5a48, lit: 0xba7059 },
] as const

export type PropKind =
  | 'heap'
  | 'drum'
  | 'fridge'
  | 'washer'
  | 'dumpster'
  | 'crate'
  | 'tireStack'
  | 'leaningTire'
  | 'leaningSheet'
  | 'greenBin'
  | 'brokenTv'

/**
 * Vật vẽ bằng drawer chung. `variant` nghĩa theo loại: `heap` = chỉ số bảng cỡ,
 * `tireStack` = số tầng, `drum` = tông sơn, `greenBin` = 1 là nắp mở.
 */
export interface DrawnProp {
  readonly kind: PropKind
  readonly x: number
  readonly y: number
  readonly variant?: number
}

/**
 * Vật có art vẽ tay ngay trong scene (nhà xưởng, chòi gác, đe, chồng bao, thùng phuy
 * cháy do `life.ts` vẽ…): ở đây chỉ khai ĐẾ, và khai ngay cạnh chỗ vẽ art.
 */
export interface FixedProp {
  readonly kind: 'fixed'
  readonly x: number
  readonly y: number
  readonly half: number
  readonly height: number
}

export type ZoneProp = DrawnProp | FixedProp

/** Cỡ đế theo loại vật — lấy đúng số đo art đã vẽ, không ước lượng. */
function baseSize(kind: PropKind, variant: number): { half: number; height: number } {
  switch (kind) {
    case 'heap': {
      const index = variant % HEAP_HALF_WIDTH.length
      return { half: (HEAP_HALF_WIDTH[index] ?? 20) + 2, height: HEAP_HEIGHT[index] ?? 30 }
    }
    case 'drum':
      return { half: 8, height: 22 }
    case 'fridge':
      return { half: 13, height: 26 }
    case 'washer':
      return { half: 10, height: 20 }
    case 'dumpster':
      return { half: 26, height: 30 }
    case 'crate':
      return { half: 9, height: 16 }
    case 'tireStack':
      return { half: 8.5, height: 4.4 * Math.max(1, variant) + 4 }
    case 'leaningTire':
      return { half: 7, height: 12 }
    case 'leaningSheet':
      return { half: 11, height: 20 }
    case 'greenBin':
      return { half: 9, height: 22 }
    case 'brokenTv':
      return { half: 8, height: 10 }
  }
}

/**
 * Hộp ĐẾ chặn của một vật, toạ độ LOCAL của khu (đường chân là mép nam của hộp).
 * Vài drawer neo ở MÉP chứ không ở tâm: `drawDumpster` nhận mép trái, `drawCrate` nhận
 * góc tây-bắc mặt nam — hộp đế phải theo đúng chỗ art chạm đất.
 */
export function propBase(prop: ZoneProp): Rect {
  if (prop.kind === 'fixed') {
    return { x: prop.x - prop.half, y: prop.y - prop.height, width: prop.half * 2, height: prop.height }
  }
  const centre = prop.kind === 'dumpster' ? prop.x + 24 : prop.kind === 'crate' ? prop.x + 9 : prop.x
  const ground = prop.kind === 'dumpster' ? prop.y + 4 : prop.kind === 'crate' ? prop.y + 14 : prop.y
  const { half, height } = baseSize(prop.kind, prop.variant ?? 0)
  return { x: centre - half, y: ground - height, width: half * 2, height }
}

/** Vẽ một vật đứng bằng drawer chung (`fixed` bỏ qua — art của nó thuộc về scene). */
export function drawProp(g: Graphics, prop: ZoneProp): void {
  if (prop.kind === 'fixed') return
  const variant = prop.variant ?? 0
  switch (prop.kind) {
    case 'heap':
      drawJunkHeap(g, prop.x, prop.y, variant)
      return
    case 'drum': {
      const tone = DRUM_TONES[variant % DRUM_TONES.length] ?? DRUM_TONES[0]
      drawDrum(g, prop.x, prop.y, tone.base, tone.lit)
      return
    }
    case 'fridge':
      drawFridge(g, prop.x, prop.y)
      return
    case 'washer':
      drawWasher(g, prop.x, prop.y)
      return
    case 'dumpster':
      drawDumpster(g, prop.x, prop.y)
      return
    case 'crate':
      drawCrate(g, prop.x, prop.y)
      return
    case 'tireStack':
      drawTireStack(g, prop.x, prop.y, variant)
      return
    case 'leaningTire':
      drawLeaningTire(g, prop.x, prop.y, 6.2)
      return
    case 'leaningSheet':
      drawLeaningSheet(g, prop.x, prop.y)
      return
    case 'greenBin':
      drawGreenBin(g, prop.x, prop.y, variant === 1)
      return
    case 'brokenTv':
      drawBrokenTv(g, prop.x, prop.y)
      return
  }
}
