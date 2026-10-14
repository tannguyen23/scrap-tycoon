import { Container, type Graphics } from 'pixi.js'
import type { GroundCanvas } from '../../tiles/groundCanvas'
import { equipItems, type HeldItem } from '../heldItems'
import { SHADOW, createPersonSprite, createSack, type PersonSprite } from '../parts'
import { POKE_ITEMS } from '../poses'

export interface ScavengerSprite extends PersonSprite {
  /** Plastic bag in the left hand — part of the poke kit, swells as cans come in. */
  bag: HeldItem
  /** Poking stick in the right hand — thrusts forward on a poke beat. */
  poker: HeldItem
}

/**
 * ¾-view scavenger: straw-hat body wearing the poke kit. The kit comes from the
 * action (POKE_ITEMS) — the scavenger keeps it on while walking too, so the
 * sticks and bag never pop in and out between states.
 */
export function createScavengerSprite(variant: number): ScavengerSprite {
  const person = createPersonSprite(variant, 'straw')
  const gear = equipItems(person, POKE_ITEMS)
  return { ...person, bag: gear.bag, poker: gear.stick }
}

export interface PorterSprite extends PersonSprite {
  /** Sack carried out front, hidden until one is lifted off the pile. */
  sack: Container
}

/** ¾-view porter: cap and a sack in front, heading for the forge. */
export function createPorterSprite(variant: number): PorterSprite {
  const person = createPersonSprite(variant, 'cap')
  const sack = new Container()
  sack.addChild(createSack(0.85))
  sack.position.set(3, -11)
  sack.visible = false
  person.container.addChild(sack)
  return { ...person, sack }
}

/**
 * Bãi rác của khu: art được vẽ theo công thức khối bốn bước (bóng tiếp xúc → viền
 * tối dưới thân → thân chia mặt tối/sáng → mặt sáng hướng trên-trái), nắng toàn
 * game ở trên-trái nên mặt nam và hông đông luôn tối hơn cạnh trên/hông tây.
 */

/** Bảng cỡ đống theo `variant` — hai đống cạnh nhau không bao giờ cùng cỡ. */
export const HEAP_HALF_WIDTH = [22, 17, 25, 15, 23, 19, 21]
export const HEAP_HEIGHT = [31, 36, 26, 40, 29, 34, 25]

/**
 * Tông lốp dùng chung với `decorItems.drawTire` — lốp là cao su xám chứ không phải
 * vòng tròn tô đen: hông tối, mặt giữa, gai lốp cắt thành vệt tối, lỗ hun hút có
 * thành trong hắt sáng ở trên-trái (nắng toàn game ở trên-trái).
 */
const TIRE_WALL = 0x1f232b
const TIRE_FACE = 0x353c48
const TIRE_LIT = 0x4a5260
const TIRE_TREAD = 0x12141a
const TIRE_HOLE = 0x14161a
const TIRE_RIM = 0x2a303a

/**
 * Lốp nằm sấp: hông lốp hở một vệt dưới vành, gai lốp cắt vệt tối trên vệt hông
 * đó, mặt trên hắt sáng trên-trái và lỗ có thành trong sáng — ba tầng đó là thứ
 * phân biệt lốp với một cái vòng. `y` = mép nam chạm đất, `rx` = nửa bề ngang.
 */
export function drawFlatTire(g: GroundCanvas, x: number, y: number, rx: number): void {
  const ry = rx * 0.46
  const cy = y - ry - 0.6
  g.ellipse(x + 1, y + 1.8, rx * 0.98, ry * 0.7).fill({ color: 0x000000, alpha: 0.16 })
  g.ellipse(x, cy + 1.6, rx, ry).fill(TIRE_WALL)
  for (const u of [-0.5, 0, 0.5]) {
    const edge = cy + 1.6 + ry * Math.sqrt(1 - u * u)
    g.rect(x + u * rx - 0.7, edge - 1.5, 1.4, 1.5).fill(TIRE_TREAD)
  }
  g.ellipse(x, cy, rx, ry).fill(TIRE_FACE)
  g.rect(x - rx * 0.5, cy - ry * 0.9, rx, 1).fill({ color: TIRE_LIT, alpha: 0.8 })
  g.ellipse(x, cy, rx * 0.5, ry * 0.47).fill(TIRE_HOLE)
  g.rect(x - rx * 0.28, cy - ry * 0.38, rx * 0.56, 0.9).fill(TIRE_RIM)
}

/**
 * Lốp dựng tựa vào hông đống/thùng: thân lốp dày ở đáy, lỗ lệch LÊN trên nên thấy
 * được thành trong xa — đúng thế của một cái lốp chĩa mặt ra ngoài mà dựa lưng vào
 * thứ khác. `y` = điểm chạm đất, `r` = bán kính ngoài.
 */
export function drawLeaningTire(g: GroundCanvas, x: number, y: number, r: number): void {
  const ry = r * 0.92
  const cy = y - ry - 0.4
  g.ellipse(x + 0.6, y + 1, r * 0.82, r * 0.28).fill({ color: 0x000000, alpha: 0.16 })
  g.ellipse(x, cy + 1.2, r, ry).fill(TIRE_WALL)
  for (const u of [-0.45, 0.45]) {
    const edge = cy + 1.2 + ry * Math.sqrt(1 - u * u)
    g.rect(x + u * r - 0.6, edge - 1.3, 1.2, 1.3).fill(TIRE_TREAD)
  }
  g.ellipse(x, cy, r, ry).fill(TIRE_FACE)
  g.rect(x - r * 0.5, cy - ry * 0.9, r, 1).fill({ color: TIRE_LIT, alpha: 0.8 })
  g.ellipse(x, cy - r * 0.17, r * 0.47, ry * 0.42).fill(TIRE_HOLE)
  g.rect(x - r * 0.26, cy - r * 0.34 - 0.45, r * 0.52, 0.9).fill(TIRE_RIM)
}

/**
 * Món nằm trên đỉnh đống theo `variant` — bãi thật không có bảy đỉnh giống nhau:
 * lốp nằm, ống bẻ cong, xô gỉ, lốp dựng tựa, cuộn dây thép. Trước đây cả bảy đống
 * đều đội một vành tròn đen y hệt, nhìn ra một dãy lỗ đen lơ lửng.
 */
export function drawHeapTopJunk(g: GroundCanvas, x: number, y: number, variant: number): void {
  const h = HEAP_HEIGHT[variant % HEAP_HEIGHT.length] ?? 30
  const jx = x + h * 0.34
  const crest = y - h
  const kind = variant % 5
  if (kind === 0) {
    drawFlatTire(g, jx, crest + 1.2, 6 + (variant % 3))
  } else if (kind === 1) {
    g.rect(jx - 1.1, crest - 8, 2.2, 9).fill(0x6b7480)
    g.rect(jx - 1.1, crest - 8, 0.9, 9).fill(0x8a97a6)
    g.rect(jx - 1.1, crest - 8, 7.4, 2.2).fill(0x6b7480)
    g.rect(jx - 1.1, crest - 8, 7.4, 0.8).fill(0x8a97a6)
    g.ellipse(jx + 6.3, crest - 6.9, 1.1, 1.5).fill(0x2e333c)
  } else if (kind === 2) {
    g.ellipse(jx + 0.5, crest + 1.6, 5, 1.8).fill({ color: 0x000000, alpha: 0.16 })
    g.rect(jx - 4, crest - 4.5, 8, 5.8).fill(0x5a6572)
    g.rect(jx - 4, crest - 4.5, 2.6, 5.8).fill(0x76828f)
    g.rect(jx + 2.4, crest - 4.5, 1.6, 5.8).fill({ color: 0x000000, alpha: 0.16 })
    g.ellipse(jx, crest - 4.5, 4, 1.7).fill(0x2e333c)
    g.rect(jx - 3.4, crest - 5.3, 6.8, 0.8).fill({ color: 0xa5b2c0, alpha: 0.5 })
    g.rect(jx - 2.6, crest - 7.4, 5.2, 0.7).fill(0x8a97a6)
  } else if (kind === 3) {
    drawLeaningTire(g, jx, crest + 1.3, 5.8 + (variant % 2) * 0.6)
  } else {
    g.ellipse(jx + 0.5, crest + 1.4, 4.6, 1.6).fill({ color: 0x000000, alpha: 0.16 })
    for (let i = 0; i < 3; i++) {
      g.rect(jx - 3.6, crest - 3.2 + i * 1.6, 7.2, 1.6).fill(i % 2 === 0 ? 0x6b7480 : 0x4d5560)
    }
    g.rect(jx - 3.6, crest - 3.2, 7.2, 0.6).fill(0x8a97a6)
  }
}

/**
 * Đống phế liệu: các khối sắt/tôn xếp lớp, nắng trên-trái nên mặt nam tối và đỉnh
 * sáng. Bề ngang/chiều cao lấy từ bảng theo `variant`: bãi thật không có hai đống
 * nào cùng cỡ, và chính cái so le đó làm bãi trông bừa chứ không xếp hàng.
 */
export function drawJunkHeap(g: GroundCanvas, x: number, y: number, variant: number): void {
  const w = HEAP_HALF_WIDTH[variant % HEAP_HALF_WIDTH.length] ?? 20
  const h = HEAP_HEIGHT[variant % HEAP_HEIGHT.length] ?? 30
  g.ellipse(x + 2, y + 3, w + 2, 7).fill(SHADOW)
  g.rect(x - w, y - 6, w * 2, 8).fill(0x4f5866)
  g.rect(x - w + 2, y - h * 0.5, w * 2 - 4, h * 0.5 - 4).fill(0x74818f)
  g.rect(x - w + 5, y - h * 0.78, w * 2 - 10, h * 0.3).fill(0x8a97a6)
  g.rect(x - w + 8, y - h, w * 2 - 16, h * 0.26).fill(0x9aa8b6)
  const cap = variant % 2 === 0 ? 0x8a5a34 : 0xa8814f
  const capLit = variant % 2 === 0 ? 0xa06a3c : 0xb08a55
  g.rect(x - h * 0.36, y - h - 7, h * 0.5, 7).fill(cap)
  g.rect(x - h * 0.36, y - h - 7, h * 0.5, 2).fill(capLit)
  g.rect(x + w - 6, y - 18, 12, 3).fill(0x8a97a6)
  g.rect(x + w - 6, y - 18, 12, 1).fill(0xaab3c0)
  drawHeapTopJunk(g, x, y, variant)
  g.rect(x - w - 4, y - 3, 6, 3).fill(0x6b7480)
  g.rect(x + w - 2, y - 2, 6, 3).fill(0x606a78)
}

/**
 * Tấm tôn dựng nghiêng vào đống: một hình bình hành nên nó cắt chéo độ cao của
 * cả cụm — thứ duy nhất phá được thế "mọi khối đều đứng thẳng".
 */
export function drawLeaningSheet(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 4, y + 1, 11, 3).fill(SHADOW)
  g.moveTo(x - 10, y + 1)
    .lineTo(x + 9, y + 3)
    .lineTo(x + 11, y - 17)
    .lineTo(x - 4, y - 22)
    .closePath()
    .fill(0x8a97a6)
  g.moveTo(x - 4, y - 22)
    .lineTo(x + 11, y - 17)
    .lineTo(x + 11, y - 15)
    .lineTo(x - 4, y - 20)
    .closePath()
    .fill(0xb4bcc6)
  for (let i = 0; i < 4; i++) {
    g.moveTo(x - 8 + i * 4.6, y + 1.4 - i * 0.5)
      .lineTo(x - 3 + i * 4.6, y - 20.5 + i * 0.3)
      .stroke({ width: 0.6, color: 0x6b7480, alpha: 0.75 })
  }
}

/** Thùng phuy đổ nằm nghiêng, đáy chĩa ra ngoài — bãi càng bừa càng thật. */
export function drawTippedDrum(g: Graphics, x: number, y: number, base: number, lit: number): void {
  g.ellipse(x + 1, y + 3, 12, 3.4).fill(SHADOW)
  g.moveTo(x - 11, y + 1)
    .lineTo(x + 10, y - 6)
    .lineTo(x + 10, y - 1)
    .lineTo(x - 11, y + 6)
    .closePath()
    .fill(base)
  g.moveTo(x - 11, y + 1)
    .lineTo(x + 10, y - 6)
    .lineTo(x + 10, y - 3.6)
    .lineTo(x - 11, y + 3.4)
    .closePath()
    .fill(lit)
  g.ellipse(x - 11, y + 3.5, 3, 3.4).fill(0x6b7480)
  g.ellipse(x - 11, y + 3.5, 1.6, 1.9).fill(0x4a525c)
  g.ellipse(x + 10, y - 3.5, 2.6, 3.1).fill(base)
}

/** Thùng rác công nghiệp: nắp mở dựng phía bắc (chiều cao giả), lòng thùng tối. */
export function drawDumpster(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 23, y + 5, 27, 8).fill(SHADOW)
  g.rect(x + 4, y - 30, 44, 9).fill(0x5a6572)
  g.rect(x + 4, y - 30, 44, 2).fill(0x76828f)
  g.rect(x + 5, y - 21, 42, 6).fill(0x2e333c)
  g.rect(x - 1, y - 15, 50, 18).fill(0x6f7a88)
  g.rect(x - 1, y - 15, 50, 3).fill(0x8b95a3)
  for (let i = 0; i < 4; i++) g.rect(x + 6 + i * 12, y - 12, 2, 13).fill(0x5c6672)
  g.circle(x + 6, y + 4, 3.2).fill(0x2b2f3d)
  g.circle(x + 42, y + 4, 3.2).fill(0x2b2f3d)
  g.rect(x + 10, y - 19, 8, 3).fill(0x8a5a34)
  g.rect(x + 26, y - 19, 6, 2).fill(0xa8814f)
}

/** Đống bao rác đen buộc nút, xếp hai lớp — chỗ picker đổ bao về. */
export function drawBagPile(g: Graphics, x: number, y: number, count: number): void {
  g.ellipse(x + 1, y + 3, 9 + count * 2, 4).fill(SHADOW)
  for (let i = 0; i < Math.min(6, count); i++) {
    const bx = x + ((i % 3) - 1) * 6 + (i > 2 ? 3 : 0)
    const by = y - Math.floor(i / 3) * 7 - 3
    g.circle(bx, by, 5.2).fill(0x39404a)
    g.circle(bx - 1.2, by - 1.4, 3.4).fill(0x4a525e)
    g.rect(bx - 1, by - 7, 2, 2.4).fill(0x2b2f38)
  }
}

/**
 * Chồng lốp nằm sấp: mỗi tầng lộ vệt hông + gai lốp ở đáy, vành trên hắt sáng, và
 * tầng trên đổ bóng xuống tầng dưới — thứ tự vẽ (thấp trước, cao sau) tự che phần
 * sau của tầng dưới nên chồng lốp đọc ra khối cao dần chứ không phải cột vành đen.
 */
export function drawTireStack(g: GroundCanvas, x: number, y: number, count: number): void {
  const rx = 8.6
  const ry = 3.5
  const step = 4.4
  g.ellipse(x + 1.5, y + 1.6, rx + 1.8, ry + 0.7).fill({ color: 0x000000, alpha: 0.16 })
  for (let i = 0; i < count; i++) {
    const ty = y - i * step
    g.ellipse(x, ty - ry + 0.6, rx, ry).fill(TIRE_WALL)
    for (const u of [-0.5, 0, 0.5]) {
      const edge = ty - ry + 0.6 + ry * Math.sqrt(1 - u * u)
      g.rect(x + u * rx - 0.7, edge - 1.4, 1.4, 1.4).fill(TIRE_TREAD)
    }
    g.ellipse(x, ty - ry - 0.6, rx, ry).fill(TIRE_FACE)
    g.rect(x - rx * 0.5, ty - ry - 0.6 - ry * 0.9, rx, 1).fill({ color: TIRE_LIT, alpha: 0.8 })
    g.ellipse(x, ty - ry - 0.6, rx * 0.5, ry * 0.45).fill(TIRE_HOLE)
    g.rect(x - rx * 0.28, ty - ry - 0.6 - ry * 0.36, rx * 0.56, 0.85).fill(TIRE_RIM)
    if (i < count - 1) {
      g.ellipse(x, ty - ry - 0.6, rx + 0.2, ry).fill({ color: 0x000000, alpha: 0.18 })
    }
  }
}

/** Xác tủ lạnh nằm nghiêng, cửa mở bung — thứ kinh điển của mọi bãi rác. */
export function drawFridge(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 1, y + 3, 13, 4).fill(SHADOW)
  g.rect(x + 8, y - 26, 9, 22).fill(0x8f959c)
  g.rect(x - 10, y - 28, 18, 30).fill(0xb9bfc6)
  g.rect(x - 10, y - 28, 18, 2).fill(0xd2d7dd)
  g.rect(x - 10, y - 28, 2, 30).fill(0xc9ced4)
  g.rect(x + 6, y - 28, 2, 30).fill(0x8f959c)
  g.rect(x - 6, y - 24, 12, 1).fill(0x9aa1a8)
  g.rect(x - 5, y - 6, 6, 2).fill({ color: 0x8a5a34, alpha: 0.85 })
}

/** Máy giặt vỡ, cửa tròn còn nguyên — vỏ móp nên hông đông tối hẳn. */
export function drawWasher(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 1, y + 2, 11, 3.6).fill(SHADOW)
  g.rect(x - 9, y - 20, 18, 22).fill(0xb2b8bf)
  g.rect(x - 9, y - 20, 18, 2).fill(0xcdd2d8)
  g.rect(x + 7, y - 20, 2, 22).fill(0x8f959c)
  g.rect(x - 7, y - 17, 14, 1.5).fill(0x9aa1a8)
  g.circle(x - 1, y - 8, 5.6).fill(0x3d444e)
  g.circle(x - 1, y - 8, 3.6).fill(0x272d35)
  g.rect(x - 7, y - 1, 14, 1).fill({ color: 0x8a5a34, alpha: 0.7 })
}

/** Pallet gỗ nằm sấp: ba thanh dọc, khe hở giữa các thanh ngang. */
export function drawPallet(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 1, y + 2, 12, 3).fill(SHADOW)
  g.rect(x - 11, y - 3, 22, 2).fill(0x7a5a34)
  for (let i = 0; i < 4; i++) {
    g.rect(x - 11 + i * 6, y - 8, 4, 5).fill(i % 2 === 0 ? 0x9c7448 : 0xa8814f)
  }
  g.rect(x - 11, y - 10, 22, 2).fill(0xb08a55)
}

/** Thùng phuy đứng, hai gân sóng — `base`/`lit` để mỗi thùng một màu sơn. */
export function drawDrum(g: Graphics, x: number, y: number, base: number, lit: number): void {
  g.ellipse(x + 1, y + 2, 8, 3.4).fill(SHADOW)
  g.rect(x - 7, y - 22, 14, 24).fill(base)
  g.rect(x + 4, y - 22, 3, 24).fill({ color: 0x000000, alpha: 0.16 })
  g.ellipse(x, y - 22, 7, 3).fill(lit)
  g.rect(x - 7, y - 16, 14, 1).fill({ color: 0x000000, alpha: 0.14 })
  g.rect(x - 7, y - 9, 14, 1).fill({ color: 0x000000, alpha: 0.14 })
}

/** Thùng gỗ một nắp — hàng chưa kịp bán nên vẫn còn trên bãi. */
export function drawCrate(g: Graphics, x: number, y: number): void {
  g.rect(x, y, 18, 14).fill(0x9c7448)
  g.rect(x, y, 18, 2).fill(0xa8814f)
  g.rect(x + 1, y + 1, 16, 12).stroke({ width: 1, color: 0x5c4426 })
  g.rect(x + 8, y, 1, 14).fill(0x5c4426)
  g.rect(x + 4, y - 6, 12, 6).fill(0xa8814f)
  g.rect(x + 4, y - 6, 12, 6).stroke({ width: 1, color: 0x5c4426 })
  g.rect(x, y + 12, 18, 2).fill({ color: 0x000000, alpha: 0.2 })
}

/** TV vỡ màn, còn cả ăng-ten — hàng điện tử chết của bãi. */
export function drawBrokenTv(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 1, y + 6, 9, 4).fill(SHADOW)
  g.rect(x - 7, y - 6, 14, 12).fill(0x3d444e)
  g.rect(x - 7, y - 6, 14, 2).fill(0x4d5560)
  g.rect(x - 4, y - 3, 8, 6).fill({ color: 0x6d7a88, alpha: 0.9 })
  g.rect(x - 2, y - 1, 4, 2).fill({ color: 0xcfe0ef, alpha: 0.6 })
  g.rect(x + 2, y - 10, 1, 4).fill(0x9aa8b6)
  g.rect(x + 6, y - 12, 1, 6).fill(0x9aa8b6)
  g.rect(x - 7, y + 4, 14, 2).fill({ color: 0x000000, alpha: 0.22 })
  g.rect(x - 5, y - 5, 1, 3).fill({ color: 0x1f2126, alpha: 0.5 })
  g.rect(x + 3, y + 1, 2, 1).fill({ color: 0x1f2126, alpha: 0.4 })
}

/** Cỏ dại mọc ở mép bãi — mặt đất bị xới nên cỏ chỉ còn ở rìa. */
export function drawWeedTuft(g: Graphics, x: number, y: number): void {
  g.rect(x, y, 1, 4).fill({ color: 0x74a05f, alpha: 0.85 })
  g.rect(x + 2, y + 1, 1, 3).fill({ color: 0x74a05f, alpha: 0.6 })
}

const BIN_BODY = 0x46964a
const BIN_LIT = 0x5cb05c
const BIN_DARK = 0x35713c

/**
 * Thùng rác nhựa xanh kiểu xe đẩy: nắp nhô khỏi thân (chiều cao giả), hai bánh
 * phía nam, nắng trên-trái nên hông tây sáng hông đông tối. `open` dựng nắp đứng
 * sau miệng thùng tối — cái thùng ai đó vừa lục xong.
 */
export function drawGreenBin(g: GroundCanvas, x: number, y: number, open = false): void {
  g.ellipse(x + 1, y + 2, 11, 3.4).fill(SHADOW)
  g.rect(x - 8, y - 19, 16, 19).fill(BIN_BODY)
  g.rect(x - 8, y - 19, 3, 19).fill(BIN_LIT)
  g.rect(x + 5, y - 19, 3, 19).fill(BIN_DARK)
  g.rect(x - 8, y - 2.5, 16, 1).fill({ color: 0x000000, alpha: 0.16 })
  g.rect(x - 7, y - 0.5, 14, 1).fill({ color: 0x000000, alpha: 0.28 })
  if (open) {
    g.rect(x - 7, y - 20.5, 14, 2.5).fill(0x2e333c)
    g.rect(x - 8, y - 27.6, 16, 5).fill(BIN_BODY)
    g.rect(x - 8, y - 27.6, 16, 1.2).fill(BIN_LIT)
    g.rect(x + 5, y - 27.6, 3, 5).fill(BIN_DARK)
  } else {
    g.rect(x - 9, y - 22, 18, 3.4).fill(BIN_BODY)
    g.rect(x - 9, y - 22, 18, 1.2).fill(BIN_LIT)
    g.rect(x - 9, y - 19.4, 18, 0.8).fill({ color: 0x000000, alpha: 0.16 })
    g.rect(x - 2.5, y - 24, 5, 1.6).fill(BIN_DARK)
  }
  g.circle(x - 5, y + 0.5, 2.2).fill(0x2b2f3d)
  g.circle(x + 5, y + 0.5, 2.2).fill(0x2b2f3d)
}

/** Thùng rác đổ nghiêng: miệng chĩa tây (lòng tối), nắp bung nằm cạnh, bánh chổng lên trời. */
export function drawTippedBin(g: GroundCanvas, x: number, y: number): void {
  g.ellipse(x + 1, y + 1.5, 14, 3).fill(SHADOW)
  g.rect(x - 8, y - 10, 16, 10).fill(BIN_BODY)
  g.rect(x - 8, y - 10, 16, 2.2).fill(BIN_LIT)
  g.rect(x + 5, y - 10, 3, 10).fill(BIN_DARK)
  g.rect(x - 8, y - 1, 16, 1).fill({ color: 0x000000, alpha: 0.28 })
  g.ellipse(x - 8, y - 5, 2.6, 4.4).fill(0x2e333c)
  g.circle(x + 2.5, y - 11, 2.2).fill(0x2b2f3d)
  g.circle(x + 7, y - 11, 2.2).fill(0x2b2f3d)
  g.rect(x - 15, y - 3, 7, 3).fill(BIN_BODY)
  g.rect(x - 15, y - 3, 7, 1).fill(BIN_LIT)
  g.rect(x - 15, y - 0.6, 7, 0.8).fill({ color: 0x000000, alpha: 0.25 })
}

const BOTTLE_TONES = [
  { body: 0x5f9a6a, lit: 0x7fbf88 },
  { body: 0x8a6a3c, lit: 0xa8874f },
  { body: 0x6f8fa8, lit: 0x8fb0c6 },
] as const

/** Chai thuỷ tinh nằm hoặc chống quanh bãi: thân + cổ + nút, cạnh trên hắt sáng. */
export function drawBottle(g: GroundCanvas, x: number, y: number, tone: number, lying: boolean): void {
  const colors = BOTTLE_TONES[tone % BOTTLE_TONES.length] ?? BOTTLE_TONES[0]
  if (lying) {
    g.ellipse(x + 0.5, y + 0.8, 4.4, 1.2).fill({ color: 0x000000, alpha: 0.14 })
    g.rect(x - 2.5, y - 2, 5, 2.4).fill(colors.body)
    g.rect(x - 2.5, y - 2, 5, 0.9).fill(colors.lit)
    g.rect(x + 2.5, y - 1.6, 1.8, 1.2).fill(colors.body)
    g.rect(x + 4.3, y - 1.9, 1.1, 1.8).fill(0xb08a55)
  } else {
    g.ellipse(x + 0.4, y + 0.6, 1.9, 0.9).fill({ color: 0x000000, alpha: 0.14 })
    g.rect(x - 1.2, y - 3.4, 2.4, 3.4).fill(colors.body)
    g.rect(x - 1.2, y - 3.4, 0.8, 3.4).fill(colors.lit)
    g.rect(x - 0.5, y - 5, 1, 1.6).fill(colors.body)
    g.rect(x - 0.7, y - 5.8, 1.4, 0.9).fill(0xb08a55)
  }
}

/** Bao rác đen buộc nút vứt lẻ — thân căng hắt sáng trên-trái, nút thắt tối. */
export function drawTrashBag(g: GroundCanvas, x: number, y: number, r: number): void {
  g.ellipse(x + 1, y + 1.6, r + 1.4, r * 0.5).fill({ color: 0x000000, alpha: 0.16 })
  g.circle(x, y - r * 0.8, r).fill(0x39404a)
  g.circle(x - r * 0.28, y - r * 1.05, r * 0.62).fill(0x4a525e)
  g.rect(x - r * 0.22, y - r * 2.1, r * 0.44, r * 0.55).fill(0x2b2f38)
  g.rect(x - r * 0.6, y - r * 0.35, r * 1.2, 0.7).fill({ color: 0x2b2f38, alpha: 0.5 })
}
