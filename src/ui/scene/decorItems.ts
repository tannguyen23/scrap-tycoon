import type { GroundCanvas } from '@ground/core/groundCanvas'
import type { ZoneRect } from './zoneLayout'

/**
 * Yard decor specimens — trees, rocks, logs and scrap, all drawn with the same
 * fake-3D recipe so a 2D sprite still reads as a solid object:
 *
 *   1. contact shadow on the ground (a soft ellipse under the base)
 *   2. dark under-edge where the body meets the ground
 *   3. body in mid tone, split into a shaded side and a lit side
 *   4. lit faces / highlights toward the top-left (the sun sits up-left)
 *
 * Every drawer takes the item's ground anchor (x, y = where it stands) and only
 * touches `GroundCanvas`, so `DECOR_SPECIMENS` doubles as the studio list and as
 * the test contract (art must fit the declared box).
 */

const SHADOW = { color: 0x000000, alpha: 0.16 } as const
const UNDER_EDGE = { color: 0x000000, alpha: 0.28 } as const

/** Contact shadow + dark under-edge: the two cues that ground an object. */
function footing(g: GroundCanvas, x: number, y: number, rx: number): void {
  g.ellipse(x + 1, y + 1.5, rx, rx * 0.45).fill(SHADOW)
  g.rect(x - rx * 0.7, y - 0.5, rx * 1.4, 1).fill(UNDER_EDGE)
}

const TREE_TONES = [
  { dark: 0x2f5528, back: 0x3c6b34, mid: 0x4f9444, lit: 0x63b052, top: 0x86d066 },
  { dark: 0x2a4f2c, back: 0x37662f, mid: 0x4a8b3e, lit: 0x5ea84b, top: 0x7cc45c },
]

/** Oak: flared trunk, layered canopy, lit from the top-left, dark under the skirt. */
export function drawTree(g: GroundCanvas, x: number, y: number, variant = 0): void {
  const tone = TREE_TONES[variant % TREE_TONES.length] ?? TREE_TONES[0]
  if (!tone) return

  footing(g, x, y, 13)
  // Thân: vỏ sáng bên trái, tối bên phải + gốc loe ra.
  g.rect(x - 2, y - 16, 4, 16).fill(0x6b543a)
  g.rect(x - 2, y - 16, 1.5, 16).fill(0x7d6344)
  g.rect(x + 0.5, y - 16, 1.5, 16).fill({ color: 0x55432f, alpha: 0.9 })
  g.rect(x - 4, y - 2, 2.5, 2.5).fill(0x6b543a)
  g.rect(x + 1.5, y - 2, 2.5, 2.5).fill(0x55432f)

  // Tán: các múi sau tối, múi trước sáng (thứ tự vẽ = thứ tự chồng).
  g.circle(x - 7, y - 17, 8).fill(tone.dark)
  g.circle(x + 7, y - 17, 8).fill(tone.back)
  g.circle(x - 9, y - 12, 6).fill(tone.back)
  g.circle(x + 9, y - 12, 6).fill(tone.back)
  g.circle(x, y - 26, 10).fill(tone.back)
  g.circle(x - 4, y - 22, 8).fill(tone.mid)
  g.circle(x + 4, y - 22, 8).fill(tone.mid)
  g.circle(x, y - 18, 9).fill(tone.lit)
  g.circle(x - 5, y - 30, 5).fill(tone.lit)
  g.circle(x + 2, y - 32, 4).fill(tone.top)
  g.circle(x - 8, y - 26, 3).fill(tone.top)
  // Bóng tối dưới tán (nơi tán che mặt đất).
  g.rect(x - 11, y - 12, 22, 2).fill({ color: tone.dark, alpha: 0.65 })
}

/** Low bush: three lobes, lit top-left, dark skirt, a couple of berries. */
export function drawBush(g: GroundCanvas, x: number, y: number, variant = 0): void {
  const tone = TREE_TONES[variant % TREE_TONES.length] ?? TREE_TONES[0]
  if (!tone) return

  footing(g, x, y, 9)
  g.circle(x - 5, y - 5, 5).fill(tone.dark)
  g.circle(x + 5, y - 5, 5).fill(tone.back)
  g.circle(x, y - 8, 6).fill(tone.mid)
  g.circle(x - 3, y - 11, 4).fill(tone.lit)
  g.circle(x + 2, y - 13, 3).fill(tone.top)
  g.rect(x - 6, y - 3, 12, 1.5).fill({ color: tone.dark, alpha: 0.6 })
  g.rect(x - 4, y - 9, 1, 1).fill(0xf2d968)
  g.rect(x + 3, y - 6, 1, 1).fill(0xe87a8a)
}

/** Cut stump: bark side with a lit edge and a ringed cut face catching the light. */
export function drawStump(g: GroundCanvas, x: number, y: number): void {
  footing(g, x, y, 7)
  // Mặt bên (thân gỗ) — sáng trái, tối phải.
  g.rect(x - 6, y - 7, 12, 7).fill(0x6b543a)
  g.rect(x - 6, y - 7, 4, 7).fill(0x7d6344)
  g.rect(x + 2, y - 7, 4, 7).fill(0x55432f)
  // Mặt cắt: ellipse với vòng năm + vầng sáng.
  g.ellipse(x, y - 8, 6, 3).fill(0x9a7d58)
  g.ellipse(x, y - 8, 4, 1.8).fill(0xa98d66)
  g.ellipse(x - 1, y - 8.5, 2, 0.8).fill(0xb99e78)
  g.rect(x - 6, y - 8.5, 12, 0.5).fill({ color: 0x000000, alpha: 0.25 })
}

/** Fallen log: bark body with a lit top, ringed end grain and a dark underside. */
export function drawLog(g: GroundCanvas, x: number, y: number): void {
  footing(g, x, y, 17)
  g.rect(x - 15, y - 10, 30, 9).fill(0x6b543a)
  g.rect(x - 15, y - 10, 30, 2.5).fill(0x8a6c48)
  g.rect(x - 15, y - 10, 2.5, 9).fill(0x7d6344)
  g.rect(x - 15, y - 2.5, 30, 1.5).fill({ color: 0x3f3122, alpha: 0.85 })
  for (let i = 0; i < 3; i++) {
    g.rect(x - 12 + i * 8, y - 7, 5, 1).fill({ color: 0x55432f, alpha: 0.7 })
  }
  // Mặt cắt bên phải: vòng năm.
  g.ellipse(x + 15, y - 5.5, 3, 4.5).fill(0x9a7d58)
  g.ellipse(x + 15, y - 5.5, 1.8, 2.6).fill(0xa98d66)
  g.ellipse(x + 15, y - 5.5, 0.8, 1.2).fill(0xb99e78)
}

/** Boulder: flat lit top face, shaded side, chips of highlight — the classic 3D test. */
export function drawRock(g: GroundCanvas, x: number, y: number, scale = 1): void {
  const w = 8 * scale
  footing(g, x, y, w + 1)
  g.rect(x - w, y - 7 * scale, w * 2, 7 * scale).fill(0x8d8b7e)
  g.rect(x - w, y - 4 * scale, w, 4 * scale).fill(0xa5a396)
  g.rect(x + w * 0.2, y - 4 * scale, w * 0.8, 4 * scale).fill(0x74726a)
  g.rect(x - w * 0.5, y - 8 * scale, w, 3 * scale).fill(0xa5a396)
  g.rect(x - w * 0.5, y - 8 * scale, w * 0.5, 1.5).fill(0xbcbaac)
  g.rect(x + w * 0.6, y - 6 * scale, 1.5, 1.5).fill({ color: 0x6b6961, alpha: 0.8 })
  g.rect(x - w, y - 1, w * 2, 1).fill(UNDER_EDGE)
}

/** Three stones of different sizes — breaks up the silhouette of a single rock. */
export function drawRockCluster(g: GroundCanvas, x: number, y: number): void {
  drawRock(g, x - 9, y + 1, 0.8)
  drawRock(g, x + 9, y + 2, 0.7)
  drawRock(g, x + 1, y - 2, 1.15)
}

/** Steel drum: shaded cylinder, lit rim on the top ellipse, two ribs. */
export function drawBarrel(g: GroundCanvas, x: number, y: number, tone = 0x5d8a74): void {
  footing(g, x, y, 8)
  g.rect(x - 7, y - 18, 14, 18).fill(tone)
  g.rect(x - 7, y - 18, 4, 18).fill({ color: 0xffffff, alpha: 0.12 })
  g.rect(x + 3, y - 18, 4, 18).fill({ color: 0x000000, alpha: 0.16 })
  g.rect(x - 7, y - 12, 14, 1.5).fill({ color: 0x000000, alpha: 0.22 })
  g.rect(x - 7, y - 5, 14, 1.5).fill({ color: 0x000000, alpha: 0.22 })
  g.ellipse(x, y - 18, 7, 2.6).fill({ color: tone, alpha: 1 })
  g.ellipse(x, y - 18.5, 5.4, 1.6).fill({ color: 0x000000, alpha: 0.35 })
  g.ellipse(x - 1, y - 19, 3, 0.8).fill({ color: 0xffffff, alpha: 0.22 })
  g.rect(x - 7, y - 1, 14, 1).fill(UNDER_EDGE)
}

/**
 * Rubber tones, matched to the alley tire art (`focus/alley/sprites.ts`): a tire
 * is grey rubber, not a black ring. Side wall in shade, mid-tone face, tread
 * nicks cut dark, and a pitch-dark hole with a lit inner edge up-left.
 */
const TIRE_WALL = 0x1f232b
const TIRE_FACE = 0x353c48
const TIRE_LIT = 0x4a5260
const TIRE_TREAD = 0x12141a
const TIRE_HOLE = 0x14161a
const TIRE_RIM = 0x2a303a

/** Single tyre lying flat: side wall peeking under the rim, tread nicks, lit crown. */
export function drawTire(g: GroundCanvas, x: number, y: number): void {
  const rx = 10
  const ry = 4.5
  const cy = y - ry - 0.6
  footing(g, x, y, rx)
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

/** Stack of tyres: each level shows its tread wall under a lit rim, the one above shades it. */
export function drawTireStack(g: GroundCanvas, x: number, y: number): void {
  const rx = 10.2
  const ry = 3.6
  const step = 5
  footing(g, x, y, rx + 1)
  for (let i = 0; i < 3; i++) {
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
    if (i < 2) {
      g.ellipse(x, ty - ry - 0.6, rx + 0.2, ry).fill({ color: 0x000000, alpha: 0.18 })
    }
  }
}

/** Pallet leaning on its side: slats with gaps, lit outer edge, dark behind. */
export function drawPallets(g: GroundCanvas, x: number, y: number): void {
  footing(g, x, y, 14)
  g.rect(x - 12, y - 22, 24, 22).fill(0x8a6c48)
  g.rect(x - 12, y - 22, 3, 22).fill(0x9c794f)
  g.rect(x + 9, y - 22, 3, 22).fill({ color: 0x000000, alpha: 0.18 })
  for (let i = 0; i < 4; i++) {
    g.rect(x - 11, y - 20 + i * 5, 22, 0.75).fill({ color: 0x000000, alpha: 0.35 })
  }
  g.rect(x - 12, y - 22, 24, 1).fill({ color: 0xffffff, alpha: 0.12 })
  g.rect(x - 12, y - 1, 24, 1).fill(UNDER_EDGE)
}

/** Concrete pipe on its side: shaded barrel, lit top band, dark mouth with a rim. */
export function drawPipe(g: GroundCanvas, x: number, y: number): void {
  footing(g, x, y, 13)
  g.rect(x - 11, y - 16, 22, 16).fill(0x8d94a2)
  g.rect(x - 11, y - 16, 22, 4).fill(0x9aa1af)
  g.rect(x - 11, y - 16, 3, 16).fill(0xa5acba)
  g.rect(x + 7, y - 16, 4, 16).fill({ color: 0x000000, alpha: 0.16 })
  g.ellipse(x + 10, y - 8, 3.4, 8).fill(0x6f7681)
  g.ellipse(x + 10, y - 8, 2.2, 5.4).fill(0x2f343c)
  g.rect(x + 9, y - 14, 1.5, 3).fill({ color: 0xc6ccd6, alpha: 0.5 })
  g.rect(x - 11, y - 1, 22, 1).fill(UNDER_EDGE)
}

/** Hand-painted yard sign: shaded post, tilted board, lit face with two text dashes. */
export function drawSign(g: GroundCanvas, x: number, y: number): void {
  footing(g, x, y, 6)
  g.rect(x - 1.5, y - 22, 3, 22).fill(0x6b543a)
  g.rect(x - 1.5, y - 22, 1.5, 22).fill(0x7d6344)
  g.rect(x - 9, y - 30, 18, 10).fill(0x96744c)
  g.rect(x - 9, y - 30, 18, 2.5).fill(0xa8814f)
  // gờ sáng mặt trên + hông đông tối: tấm biển đọc ra một khối, không phải mặt dán
  g.rect(x - 9, y - 30, 18, 1).fill({ color: 0xffffff, alpha: 0.22 })
  g.rect(x + 8, y - 30, 1, 10).fill({ color: 0x000000, alpha: 0.18 })
  g.rect(x - 9, y - 22.5, 18, 1).fill({ color: 0x000000, alpha: 0.25 })
  g.rect(x - 7, y - 27, 9, 1.5).fill({ color: 0xf5ecd6, alpha: 0.9 })
  g.rect(x - 7, y - 24.5, 12, 1).fill({ color: 0xf5ecd6, alpha: 0.6 })
}

/** Tall grass tuft: layered blades, front ones lighter (reads as a clump, not a line). */
export function drawTuft(g: GroundCanvas, x: number, y: number): void {
  g.ellipse(x, y, 6, 2).fill({ color: 0x000000, alpha: 0.12 })
  g.rect(x - 4, y - 5, 1.5, 5).fill(0x4f9444)
  g.rect(x + 3, y - 6, 1.5, 6).fill(0x57a04a)
  g.rect(x - 1.5, y - 8, 1.5, 8).fill(0x63b052)
  g.rect(x + 1, y - 10, 1, 9).fill(0x74c05e)
  g.rect(x - 3, y - 3, 1, 3).fill(0x4a8b3e)
  g.rect(x, y - 5, 1, 4).fill(0x7cc45c)
}

/** Two crates, one with an open lid: lit tops, dark insides, plank lines. */
export function drawCrateStack(g: GroundCanvas, x: number, y: number): void {
  footing(g, x, y, 13)
  g.rect(x - 12, y - 11, 22, 11).fill(0x9c7448)
  g.rect(x - 12, y - 11, 22, 2.5).fill(0xa8814f)
  g.rect(x - 12, y - 4, 22, 2).fill({ color: 0x000000, alpha: 0.2 })
  g.rect(x - 6, y - 11, 1, 11).fill(0x5c4426)
  g.rect(x + 4, y - 22, 16, 11).fill(0xa8814f)
  g.rect(x + 4, y - 22, 16, 2).fill(0xb9925c)
  g.rect(x + 5, y - 20.5, 14, 4).fill({ color: 0x3a2c1c, alpha: 0.55 })
  g.rect(x + 4, y - 12, 16, 1).fill({ color: 0x000000, alpha: 0.25 })
}

/** Scrap heap: stacked plates with lit top edges — the yard's signature clutter. */
export function drawScrapPile(g: GroundCanvas, x: number, y: number): void {
  footing(g, x, y, 18)
  g.rect(x - 17, y - 6, 20, 6).fill(0x74818f)
  g.rect(x - 17, y - 6, 20, 2).fill(0x93a1b0)
  g.rect(x - 10, y - 12, 14, 6).fill(0x8a97a6)
  g.rect(x - 10, y - 12, 14, 2).fill(0xa8b5c2)
  g.rect(x + 2, y - 8, 14, 4).fill(0x74818f)
  g.rect(x + 2, y - 8, 14, 1.5).fill(0x9aa8b6)
  g.rect(x - 4, y - 16, 10, 4).fill(0x93a1b0)
  g.rect(x - 4, y - 16, 10, 1.5).fill(0xaab3c0)
  g.rect(x + 6, y - 19, 6, 3).fill(0xb08a55)
  g.rect(x + 6, y - 19, 6, 1).fill(0xc9a06a)
  g.rect(x - 14, y - 4, 3, 1).fill({ color: 0x6b7480, alpha: 0.9 })
  g.rect(x + 12, y - 6, 2, 1).fill({ color: 0xaab3c0, alpha: 0.9 })
  // Lốp cũ nằm chỏng: vành cao su quanh lỗ tối, cùng tông với lốp rời.
  g.ellipse(x + 14, y - 2, 4, 3).fill(TIRE_FACE)
  g.ellipse(x + 14, y - 2.3, 1.9, 1.4).fill(TIRE_HOLE)
}

export interface DecorSpecimen {
  key: string
  label: string
  group: string
  /** Declared box: art must stay inside ±width/2 of the anchor and `height` above it. */
  width: number
  height: number
  draw: (g: GroundCanvas, x: number, y: number) => void
}

/**
 * How far a contact shadow may spill below the anchor (px). Widest pieces read
 * as sitting on the ground only with a soft patch under them, so the declared
 * box has to allow it — and so does anything that tests the box's footprint.
 */
export const SHADOW_SPILL = 10

/**
 * Footprint of a specimen placed at (x, y) in world px. Single source for
 * "where does a hand-placed prop actually stand" — layout tests use it to keep
 * props out of the zones.
 */
export function decorBox(specimen: DecorSpecimen, x: number, y: number): ZoneRect {
  return { x: x - specimen.width / 2, y: y - specimen.height, width: specimen.width, height: specimen.height + SHADOW_SPILL }
}

/** The catalog the studio lists and the tests walk. */
export const DECOR_SPECIMENS: readonly DecorSpecimen[] = [
  { key: 'tree0', label: 'cây sồi tối', group: 'Cây cối', width: 48, height: 44, draw: (g, x, y) => drawTree(g, x, y, 0) },
  { key: 'tree1', label: 'cây sồi tươi', group: 'Cây cối', width: 48, height: 44, draw: (g, x, y) => drawTree(g, x, y, 1) },
  { key: 'bush0', label: 'bụi cây tối', group: 'Cây cối', width: 30, height: 22, draw: (g, x, y) => drawBush(g, x, y, 0) },
  { key: 'bush1', label: 'bụi cây tươi', group: 'Cây cối', width: 30, height: 22, draw: (g, x, y) => drawBush(g, x, y, 1) },
  { key: 'stump', label: 'gốc cây', group: 'Cây cối', width: 20, height: 14, draw: drawStump },
  { key: 'log', label: 'khúc gỗ', group: 'Cây cối', width: 40, height: 14, draw: drawLog },
  { key: 'tuft', label: 'cụm cỏ cao', group: 'Cây cối', width: 18, height: 14, draw: drawTuft },
  { key: 'rock', label: 'hòn đá', group: 'Đá & mặt đất', width: 24, height: 12, draw: (g, x, y) => drawRock(g, x, y, 1) },
  { key: 'rockSmall', label: 'đá nhỏ', group: 'Đá & mặt đất', width: 22, height: 11, draw: (g, x, y) => drawRock(g, x, y, 0.9) },
  { key: 'rockBig', label: 'đá lớn', group: 'Đá & mặt đất', width: 27, height: 14, draw: (g, x, y) => drawRock(g, x, y, 1.1) },
  { key: 'rockCluster', label: 'cụm đá', group: 'Đá & mặt đất', width: 40, height: 14, draw: drawRockCluster },
  { key: 'barrel0', label: 'thùng phuy xanh', group: 'Phế liệu', width: 22, height: 26, draw: (g, x, y) => drawBarrel(g, x, y) },
  { key: 'barrel1', label: 'thùng phuy gỉ', group: 'Phế liệu', width: 22, height: 26, draw: (g, x, y) => drawBarrel(g, x, y, 0x8a6a52) },
  { key: 'tire', label: 'lốp xe', group: 'Phế liệu', width: 24, height: 14, draw: drawTire },
  { key: 'tireStack', label: 'chồng lốp', group: 'Phế liệu', width: 26, height: 22, draw: drawTireStack },
  { key: 'pipe', label: 'ống bê tông', group: 'Phế liệu', width: 30, height: 20, draw: drawPipe },
  { key: 'scrap', label: 'đống sắt vụn', group: 'Phế liệu', width: 44, height: 24, draw: drawScrapPile },
  { key: 'pallets', label: 'pallet gỗ', group: 'Hàng hoá', width: 32, height: 26, draw: drawPallets },
  { key: 'crates', label: 'chồng thùng gỗ', group: 'Hàng hoá', width: 40, height: 26, draw: drawCrateStack },
  { key: 'sign', label: 'biển gỗ', group: 'Hàng hoá', width: 22, height: 34, draw: drawSign },
]