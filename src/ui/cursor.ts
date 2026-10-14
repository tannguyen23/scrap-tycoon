/**
 * Con trỏ chuột là **art code** — không có file ảnh. Mỗi cursor là một lưới ký tự
 * ('.' = trong suốt, ký tự khác tra `CURSOR_PALETTE`), render thành PNG data-URL
 * ngay lúc boot rồi nhét vào CSS variable (`--cursor-*` trong `ui/theme.css`).
 * Vì sao dùng PNG thay vì SVG: Safari không hỗ trợ `cursor: url(svg)`.
 * Mọi lưới × `scale` phải ≤ 32px — giới hạn con trỏ của Windows.
 */
export type CursorKind = 'default' | 'pointer' | 'grab' | 'grabbing'

export interface CursorSpec {
  readonly grid: readonly string[]
  /** Mỗi ô art = scale × scale px trên màn hình (art 13px → con trỏ 26px). */
  readonly scale: number
  /** Điểm "bấm" tính theo ô art; phải nằm trên một ô có vẽ. */
  readonly hotspot: { readonly x: number; readonly y: number }
}

/** Găng tay công nhân: viền than nâu, vải kem, băng cổ tay cam, tông tối cho nếp. */
export const CURSOR_PALETTE: Record<string, string> = {
  '#': '#201810',
  W: '#f5ecd6',
  S: '#cbbb9a',
  O: '#ffb454',
}

/** Bàn tay mở — dùng cho vùng thường lẫn lúc kéo bản đồ (grab). */
const OPEN_HAND: readonly string[] = [
  '..#WW#WW#WW#.',
  '..#WW#WW#WW#.',
  '..#WW#WW#WW#.',
  '..#WW#WW#WW#.',
  '..#WW#WW#WW#.',
  '..#WWWWWWWW#.',
  '#WWWWWWWWWW#.',
  '#WWWWWWWWWW#.',
  '#WWWWWWWWWW#.',
  '.#WWWWWWWWW#.',
  '.#SSSSSSSSS#.',
  '.#OOOOOOOOO#.',
  '.#OOOOOOOOO#.',
  '.###########.',
]

/** Tay chỉ (hover) — ngón trỏ dựng đứng trên khối ngón gấp. */
const POINTING_HAND: readonly string[] = [
  '.....#WW#.....',
  '.....#WW#.....',
  '.....#WW#.....',
  '.....#WW#.....',
  '.....#WW#.....',
  '...#WWWWWW#...',
  '..#WW#WW#WW#..',
  '..#WW#WW#WW#..',
  '..#WW#WW#WW#..',
  '..#WWWWWWWW#..',
  '..#WWWWWWWW#..',
  '..#OOOOOOOO#..',
  '..#OOOOOOOO#..',
  '..##########..',
]

/** Nắm đấm (đang kéo bản đồ). */
const FIST: readonly string[] = [
  '..#########..',
  '.#WWWWWWWWW#.',
  '#WWWWWWWWWWW#',
  '#WW#WW#WW#WW#',
  '#WW#WW#WW#WW#',
  '#WW#WW#WW#WW#',
  '#WWWWWWWWWWW#',
  '#WWWWWWWWWWW#',
  '.#SSSSSSSSS#.',
  '.#OOOOOOOOO#.',
  '.#OOOOOOOOO#.',
  '.###########.',
]

export const CURSOR_SPECS: Record<CursorKind, CursorSpec> = {
  default: { grid: OPEN_HAND, scale: 2, hotspot: { x: 6, y: 6 } },
  pointer: { grid: POINTING_HAND, scale: 2, hotspot: { x: 6, y: 0 } },
  grab: { grid: OPEN_HAND, scale: 2, hotspot: { x: 6, y: 6 } },
  grabbing: { grid: FIST, scale: 2, hotspot: { x: 6, y: 4 } },
}

function renderCursorPng(spec: CursorSpec): string | null {
  const canvas = document.createElement('canvas')
  const width = (spec.grid[0]?.length ?? 0) * spec.scale
  const height = spec.grid.length * spec.scale
  if (width === 0 || height === 0) return null
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  spec.grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = CURSOR_PALETTE[row[x] ?? '.']
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x * spec.scale, y * spec.scale, spec.scale, spec.scale)
    }
  })
  return canvas.toDataURL('image/png')
}

/**
 * Render bộ cursor và gắn vào `<html>` dưới dạng `--cursor-default|pointer|grab|grabbing`.
 * Gọi một lần lúc boot (game + studio); nếu canvas không có thì CSS tự rơi về con trỏ hệ điều hành.
 */
export function installCursor(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const [kind, spec] of Object.entries(CURSOR_SPECS)) {
    const url = renderCursorPng(spec)
    if (!url) continue
    const hx = spec.hotspot.x * spec.scale
    const hy = spec.hotspot.y * spec.scale
    root.style.setProperty(`--cursor-${kind}`, `url("${url}") ${hx} ${hy}`)
  }
}
