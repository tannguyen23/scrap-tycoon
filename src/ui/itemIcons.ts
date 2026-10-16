/**
 * Icon hàng hoá cũng là **art code** — không có file ảnh, đúng như `cursor.ts`:
 * mỗi món là một lưới ký tự ('.' = trong suốt, ký tự khác tra `ICON_PALETTE`),
 * render thành PNG data-URL một lần rồi cache. Lưới vẽ theo công thức khối của dự
 * án: bóng tiếp xúc lệch xuống-phải → viền tối → thân chia mặt trên/mặt trước →
 * mặt sáng hướng trên-trái.
 */
export type IconIds = string

/** Bảng màu dùng chung cho mọi icon (nắng ở trên-trái như cả game). */
export const ICON_PALETTE: Record<string, string> = {
  '#': '#221a12',
  K: '#3a2c1c',
  S: '#5c6470',
  M: '#8b939e',
  H: '#c6cfda',
  R: '#8a5a34',
  r: '#b07a45',
  W: '#cdb78d',
  C: '#e8d5a3',
  w: '#9b8557',
  O: '#a8814f',
  G: '#8a6a3c',
  g: '#5f4526',
  // Trang bị: nón bảo hộ vàng, áo phản quang, yếm denim, ủng cao su.
  Y: '#f2c14a',
  y: '#c99a2e',
  Z: '#fbe08a',
  V: '#e8a13c',
  v: '#b8762a',
  E: '#d9dfe6',
  B: '#35507a',
  b: '#26395a',
  D: '#3a4048',
  d: '#262b31',
}

/** Sắt vụn: tấm tôn gỉ, lon móp và mấy vòng dây thép. */
const SCRAP: readonly string[] = [
  '................',
  '................',
  '....HHHH........',
  '...#MMMM#.......',
  '..#MMMMMM#......',
  '..########......',
  '........#HHH#...',
  '.......#MMMMM#..',
  '.......#MMRMM#..',
  '.......#MMMMM#..',
  '.......#######..',
  '....rrr.........',
  '...rr.rr........',
  '...KKKKKKKKKK...',
  '................',
  '................',
]

/** Bao phế liệu: bao gai buộc nút, bụng phình, đáy tối. */
const SACK: readonly string[] = [
  '................',
  '.......##.......',
  '......#CC#......',
  '......#WW#......',
  '.....##WW##.....',
  '....#WWWWWW#....',
  '...#WWCWWWWW#...',
  '..#WWWWWWWWWW#..',
  '..#WWWWWWWWWW#..',
  '..#WWWWWWWWwW#..',
  '..#WWWWWWWWww#..',
  '..#WWWWWWWwww#..',
  '..############..',
  '...KKKKKKKKKK...',
  '................',
  '................',
]

/** Phôi tái chế: ba cây thép xếp lệch, mặt trên hắt sáng. */
const BILLET: readonly string[] = [
  '................',
  '................',
  '................',
  '...HHHHHHHHHH...',
  '..#MMMMMMMMMM#..',
  '..#SSSSSSSSSS#..',
  '..############..',
  '..HHHHHHHHHHHH..',
  '..MMMMMMMMMMMM..',
  '..SSSSSSSSSSSS..',
  '..############..',
  '.HHHHHHHHHHHHHH.',
  '.MMMMMMMMMMMMMM.',
  '.SSSSSSSSSSSSSS.',
  '.KKKKKKKKKKKKKK.',
  '................',
]

/** Pallet phôi: hai cây phôi nằm trên sàn gỗ, chân pallet thấp. */
const PALLET: readonly string[] = [
  '................',
  '................',
  '...HHHHHHHHHH...',
  '..MMMMMMMMMMMM..',
  '..############..',
  '..HHHHHHHHHHHH..',
  '..MMMMMMMMMMMM..',
  '..############..',
  '.OOOOOOOOOOOOOO.',
  '.GGGGGGGGGGGGGG.',
  '.GGG..GGGG..GGG.',
  '.GGG..GGGG..GGG.',
  '.KKKKKKKKKKKKKK.',
  '................',
  '................',
  '................',
]

/** Kiện hàng: thùng gỗ đóng đinh, mặt trên sáng hơn mặt trước. */
const CRATE: readonly string[] = [
  '................',
  '................',
  '..############..',
  '..#HHHHHHHHHH#..',
  '..#OOOOOOOOOO#..',
  '..############..',
  '..#GGGGGGGGGG#..',
  '..#G#GGGGGG#G#..',
  '..#GGGGGGGGGG#..',
  '..#GG#GGGG#GG#..',
  '..#GGGGGGGGGG#..',
  '..#gggggggggg#..',
  '..############..',
  '...KKKKKKKKKK...',
  '................',
  '................',
]

/** Icon theo item id; món không có ở đây thì chỗ gọi tự vẽ ô trống. */
export const ITEM_ICONS: Record<IconIds, readonly string[]> = {
  scrap: SCRAP,
  sack: SACK,
  billet: BILLET,
  pallet: PALLET,
  crate: CRATE,
}

/** Nón bảo hộ: chum vàng ba bậc, vành hẹp, gầm vành tối. */
const HARD_HAT: readonly string[] = [
  '................',
  '................',
  '................',
  '.....YYYYYY.....',
  '....ZZZZZZZZ....',
  '....YYYYYYYY....',
  '...YYYYYYYYYY...',
  '..YYYYYYYYYYYY..',
  '.YYYYYYYYYYYYYY.',
  '.yyyyyyyyyyyyyy.',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
  '................',
  '................',
  '................',
]

/** Áo phản quang: nền cam, hai sọc bạc, gấu áo tối. */
const VEST: readonly string[] = [
  '................',
  '................',
  '..VVVVVVVVVVVV..',
  '..ZZVVVVVVVVVV..',
  '..EEEEEEEEEEEE..',
  '..VVVVVVVVVVVV..',
  '..VVVVVVVVVVVV..',
  '..EEEEEEEEEEEE..',
  '..VVVVVVVVVVVV..',
  '..VvvvvvvvvvvV..',
  '..vvvvvvvvvvvv..',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
  '................',
  '................',
]

/** Quần yếm: hai quai, tấm yếm có túi, hai ống quần tối dần. */
const OVERALLS: readonly string[] = [
  '................',
  '..BB........BB..',
  '..BBBBBBBBBBBB..',
  '..ZBBBBBBBBBBZ..',
  '..BBBBBBBBBBBB..',
  '..BBBBZZZZBBBB..',
  '..BBBBBBBBBBBB..',
  '..BBBB....BBBB..',
  '..BBBB....BBBB..',
  '..BBBB....BBBB..',
  '..bbbb....bbbb..',
  '..KKKK....KKKK..',
  '................',
  '................',
  '................',
  '................',
]

/** Ủng cao su: hai ống cao, bàn chân loe, đế tối. */
const BOOTS: readonly string[] = [
  '................',
  '................',
  '..DDD......DDD..',
  '..DDD......DDD..',
  '..DDD......DDD..',
  '..DDD......DDD..',
  '..DDD......DDD..',
  '..DDDD....DDDD..',
  '..DDDD....DDDD..',
  '..dddd....dddd..',
  '..KKKK....KKKK..',
  '................',
  '................',
  '................',
  '................',
  '................',
]

/** Icon theo id trang bị (`GearDef.style` / `GearDef.id`). */
export const GEAR_ICONS: Record<IconIds, readonly string[]> = {
  'hard-hat': HARD_HAT,
  vest: VEST,
  overalls: OVERALLS,
  'rubber-boots': BOOTS,
}

const cache = new Map<string, string | null>()

/**
 * PNG data-URL của icon một loại hàng, hoặc null khi món đó không có icon (hoặc
 * khi chưa có DOM — test chạy trong node nên không được nổ).
 */
export function itemIcon(itemId: IconIds, scale = 2): string | null {
  return render('item', itemId, ITEM_ICONS, scale)
}

/** Như `itemIcon` nhưng cho trang bị (`GEAR_ICONS`). */
export function gearIcon(gearId: IconIds, scale = 2): string | null {
  return render('gear', gearId, GEAR_ICONS, scale)
}

function render(kind: string, id: IconIds, table: Record<IconIds, readonly string[]>, scale: number): string | null {
  const key = `${kind}:${id}@${scale}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const grid = table[id]
  const url = grid ? renderPng(grid, scale) : null
  cache.set(key, url)
  return url
}

function renderPng(grid: readonly string[], scale: number): string | null {
  if (typeof document === 'undefined') return null
  const width = (grid[0]?.length ?? 0) * scale
  const height = grid.length * scale
  if (width === 0 || height === 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = ICON_PALETTE[row[x] ?? '.']
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  })
  return canvas.toDataURL('image/png')
}
