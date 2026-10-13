import type { GroundCanvas } from './groundCanvas'

/**
 * Ground scatter specimens — the small decorations the scatter pass sprinkles
 * on grass (flora), dirt (debris) and water (floating junk and water plants).
 *
 * Drawing goes through `GroundCanvas` so the coordinates of every specimen can
 * be asserted in tests without a renderer.
 */

/** How many flora specimens `drawFloraItem` can render. */
export const FLORA_KINDS = 8
/** How many debris specimens `drawDebrisItem` can render. */
export const DEBRIS_KINDS = 5
/** How many floating specimens `drawWaterItem` can render. */
export const WATER_KINDS = 12

/** Which flora a drift holds: a flower meadow in one patch, tufts in the next. */
export function pickFloraKind(mix: number, rnd: () => number): number {
  const tufts = () => 4 + Math.floor(rnd() * (FLORA_KINDS - 4))
  const flowers = () => Math.floor(rnd() * 4)
  if (mix < 0.35) return rnd() < 0.72 ? flowers() : tufts()
  if (mix > 0.65) return rnd() < 0.72 ? tufts() : flowers()
  return Math.floor(rnd() * FLORA_KINDS)
}

/** Which debris a drift holds: a stone field here, twigs and leaves there. */
export function pickDebrisKind(mix: number, rnd: () => number): number {
  if (mix < 0.4) return rnd() < 0.7 ? (rnd() < 0.5 ? 0 : 3) : 4
  if (mix > 0.6) return rnd() < 0.7 ? (rnd() < 0.5 ? 1 : 2) : 4
  return Math.floor(rnd() * DEBRIS_KINDS)
}

/**
 * Which floating item a drift holds: oily scum and cans where the water is
 * dirty, leaves and water plants where it is calm — with the odd lotus or
 * hyacinth flower scattered anywhere.
 */
export function pickWaterKind(mix: number, rnd: () => number): number {
  if (mix > 0.62) {
    const roll = rnd()
    if (roll < 0.28) return 1
    if (roll < 0.46) return 5
    if (roll < 0.62) return 9
    if (roll < 0.78) return 11
    if (roll < 0.9) return 8
    return 10
  }
  if (mix < 0.4) return rnd() < 0.6 ? 0 : 2 + Math.floor(rnd() * 2)
  const roll = rnd()
  return roll < 0.75 ? Math.floor(rnd() * 8) : 8 + Math.floor(rnd() * 4)
}

/** Grass flora: flowers, lush tufts, mushrooms, tiny bushes. */
export function drawFloraItem(g: GroundCanvas, x: number, y: number, kind: number, rnd: () => number): void {
  switch (kind) {
    case 0: {
      // hoa cúc trắng
      g.rect(x, y, 1, 2).fill({ color: 0x4a7a3a, alpha: 1 })
      g.rect(x - 1, y - 2, 1, 1).fill({ color: 0xf5f2e0, alpha: 1 })
      g.rect(x + 1, y - 2, 1, 1).fill({ color: 0xf5f2e0, alpha: 1 })
      g.rect(x, y - 3, 1, 1).fill({ color: 0xf5f2e0, alpha: 1 })
      g.rect(x, y - 2, 1, 1).fill({ color: 0xe8c34f, alpha: 1 })
      break
    }
    case 1: {
      // hoa vàng
      g.rect(x, y, 1, 2).fill({ color: 0x4a7a3a, alpha: 1 })
      g.rect(x - 1, y - 3, 1, 1).fill({ color: 0xf2d968, alpha: 1 })
      g.rect(x + 1, y - 3, 1, 1).fill({ color: 0xf2d968, alpha: 1 })
      g.rect(x, y - 4, 1, 1).fill({ color: 0xf2d968, alpha: 1 })
      g.rect(x, y - 3, 1, 1).fill({ color: 0xe09a3a, alpha: 1 })
      break
    }
    case 2: {
      // hoa hồng nhỏ
      g.rect(x, y, 1, 2).fill({ color: 0x4a7a3a, alpha: 1 })
      g.rect(x - 1, y - 2, 1, 1).fill({ color: 0xe87a8a, alpha: 1 })
      g.rect(x + 1, y - 2, 1, 1).fill({ color: 0xe87a8a, alpha: 1 })
      g.rect(x, y - 3, 1, 1).fill({ color: 0xd85a6a, alpha: 1 })
      break
    }
    case 3: {
      // hoa xanh biếc
      g.rect(x, y, 1, 2).fill({ color: 0x4a7a3a, alpha: 1 })
      g.rect(x - 1, y - 2, 1, 1).fill({ color: 0x9ab8f0, alpha: 1 })
      g.rect(x + 1, y - 2, 1, 1).fill({ color: 0x9ab8f0, alpha: 1 })
      g.rect(x, y - 3, 1, 1).fill({ color: 0x7a9fe0, alpha: 1 })
      break
    }
    case 4: {
      // cụm cỏ rậm
      const tones = [0x5f9448, 0x74a05f, 0x86b266]
      g.rect(x, y, 1, 3.5).fill({ color: tones[0] ?? 0x74a05f, alpha: 0.9 })
      g.rect(x + 1.5, y - 1.5, 1, 4).fill({ color: tones[1] ?? 0x74a05f, alpha: 0.9 })
      g.rect(x + 3, y - 0.5, 1, 3).fill({ color: tones[2] ?? 0x74a05f, alpha: 0.9 })
      break
    }
    case 5: {
      // nấm
      g.rect(x, y - 1, 1, 2).fill({ color: 0xe8dcc0, alpha: 1 })
      g.rect(x - 1, y - 2, 3, 1).fill({ color: 0xc25a4a, alpha: 1 })
      g.rect(x, y - 2.5, 1, 0.5).fill({ color: 0xf0e4d0, alpha: 1 })
      break
    }
    case 6: {
      // bụi nhỏ
      g.rect(x, y, 3, 2).fill({ color: 0x4f9444, alpha: 1 })
      g.rect(x + 0.5, y - 1, 2, 1.5).fill({ color: 0x63b052, alpha: 1 })
      if (rnd() < 0.4) g.rect(x - 0.5, y - 0.5, 1.5, 1.5).fill({ color: 0x57a04a, alpha: 1 })
      break
    }
    default: {
      // chùm cỏ ba lá
      g.rect(x, y, 1, 1).fill({ color: 0x63b052, alpha: 1 })
      g.rect(x + 1.5, y, 1, 1).fill({ color: 0x63b052, alpha: 1 })
      g.rect(x + 0.5, y - 1, 1, 1).fill({ color: 0x63b052, alpha: 1 })
      break
    }
  }
}

/** Universal debris: pebbles, twigs, leaves, rocks, cracks. */
export function drawDebrisItem(g: GroundCanvas, x: number, y: number, kind: number, rnd: () => number): void {
  switch (kind) {
    case 0: {
      g.rect(x, y, 1.5, 1).fill({ color: 0x8d8b7e, alpha: 0.85 })
      if (rnd() < 0.5) g.rect(x + 2, y + 1, 1, 1).fill({ color: 0x6f6d61, alpha: 0.8 })
      break
    }
    case 1: {
      g.rect(x, y, 3.5, 1).fill({ color: 0x8b6e4e, alpha: 0.8 })
      g.rect(x + 2, y - 1, 1, 2).fill({ color: 0x8b6e4e, alpha: 0.6 })
      break
    }
    case 2: {
      // lá rụng
      g.rect(x, y, 1.5, 1).fill({ color: 0x9a6a3a, alpha: 0.85 })
      g.rect(x + 1, y - 0.5, 1, 1).fill({ color: 0xb08a4a, alpha: 0.7 })
      break
    }
    case 3: {
      // đá nhỏ
      g.rect(x, y, 2, 1.5).fill({ color: 0x8d8b7e, alpha: 0.95 })
      g.rect(x + 0.5, y - 0.5, 1, 1).fill({ color: 0xa5a396, alpha: 0.9 })
      break
    }
    default: {
      g.rect(x, y, 3, 1).fill({ color: 0x3f4650, alpha: 0.35 })
      break
    }
  }
}

/**
 * Floating junk and water life on a pond: oily scum, cans and bottles, drifting
 * leaves and twigs, foam and ripples, plus the water plants that make a still
 * pond read as alive — duckweed mats (bèo tấm), water hyacinth (lục bình) and
 * lotus flowers (sen) with their pads.
 */
export function drawWaterItem(g: GroundCanvas, x: number, y: number, kind: number, rnd: () => number): void {
  switch (kind) {
    case 0: {
      // váng dầu
      g.rect(x, y, 3, 1).fill({ color: 0x2b3a44, alpha: 0.5 })
      g.rect(x + 1, y + 1, 2, 1).fill({ color: 0x4a5f6a, alpha: 0.35 })
      if (rnd() < 0.5) g.rect(x + 2, y - 1, 1, 1).fill({ color: 0x7f95a0, alpha: 0.25 })
      break
    }
    case 1: {
      // lá trôi
      g.rect(x - 1, y + 1, 1, 1).fill({ color: 0x2a5070, alpha: 0.35 })
      g.rect(x, y, 2, 1).fill({ color: 0x9a6a3a, alpha: 0.9 })
      g.rect(x + 1, y - 1, 1, 1).fill({ color: 0xb08a4a, alpha: 0.8 })
      break
    }
    case 2: {
      // vỏ lon trôi
      g.rect(x, y + 1.5, 2, 0.5).fill({ color: 0x2a5070, alpha: 0.4 })
      g.rect(x, y, 2, 1.5).fill({ color: 0xc9d2dc, alpha: 1 })
      g.rect(x, y, 1, 1.5).fill({ color: 0x9aa8b6, alpha: 1 })
      break
    }
    case 3: {
      // bọt nước
      g.rect(x, y, 1, 1).fill({ color: 0xe8f4fa, alpha: 0.7 })
      g.rect(x + 1.5, y + 0.5, 1, 1).fill({ color: 0xcfe4f5, alpha: 0.6 })
      if (rnd() < 0.5) g.rect(x + 3, y, 1, 1).fill({ color: 0xcfe4f5, alpha: 0.45 })
      break
    }
    case 4: {
      // cành khô trôi
      g.rect(x, y + 1, 4, 1).fill({ color: 0x2a5070, alpha: 0.3 })
      g.rect(x, y, 4, 1).fill({ color: 0x6b5136, alpha: 0.85 })
      g.rect(x + 2, y - 1, 1, 1).fill({ color: 0x7d6344, alpha: 0.7 })
      break
    }
    case 5: {
      // bèo / tảo
      g.rect(x, y, 1.5, 1).fill({ color: 0x4f8a4a, alpha: 0.8 })
      g.rect(x + 2, y + 0.5, 1, 1).fill({ color: 0x63a055, alpha: 0.75 })
      g.rect(x + 1, y - 1, 1, 1).fill({ color: 0x3d6b39, alpha: 0.7 })
      break
    }
    case 6: {
      // gợn sóng đôi
      g.rect(x, y, 3, 0.5).fill({ color: 0xa8dcec, alpha: 0.4 })
      g.rect(x + 1, y + 1.5, 3, 0.5).fill({ color: 0xa8dcec, alpha: 0.3 })
      break
    }
    case 7: {
      // chai thuỷ tinh trôi
      g.rect(x, y + 2, 2, 0.5).fill({ color: 0x2a5070, alpha: 0.35 })
      g.rect(x, y, 1, 2).fill({ color: 0x6f9f7f, alpha: 0.85 })
      g.rect(x + 1, y + 0.5, 1, 1.5).fill({ color: 0x88b89a, alpha: 0.8 })
      break
    }
    case 8: {
      // bông lục bình: cụm lá + bông tím
      g.rect(x - 1, y + 1, 2, 1).fill({ color: 0x4f8a4a, alpha: 0.85 })
      g.rect(x + 1.5, y, 2, 1).fill({ color: 0x63a055, alpha: 0.85 })
      g.rect(x - 0.5, y + 2, 1.5, 1).fill({ color: 0x3d6b39, alpha: 0.6 })
      g.rect(x, y - 2, 1, 3).fill({ color: 0x6fae5a, alpha: 0.9 })
      g.rect(x - 0.5, y - 4, 1, 2).fill({ color: 0x8f7fd0, alpha: 0.95 })
      g.rect(x + 0.5, y - 3, 1, 1).fill({ color: 0xb49ae0, alpha: 0.9 })
      g.rect(x, y - 4.5, 1, 0.5).fill({ color: 0xd8c8f0, alpha: 0.85 })
      break
    }
    case 9: {
      // bèo tấm: mảng hạt li ti
      for (let i = 0; i < 4; i++) {
        g.rect(x + (i % 2) * 1.5, y + Math.floor(i / 2) * 1, 1.5, 1).fill({
          color: i % 3 === 0 ? 0x7fc06a : 0x5f9e4a,
          alpha: 0.85,
        })
      }
      if (rnd() < 0.6) g.rect(x + 3, y + 0.5, 1, 1).fill({ color: 0x5f9e4a, alpha: 0.8 })
      break
    }
    case 10: {
      // hoa sen nổi
      g.rect(x, y + 1, 3, 1).fill({ color: 0x4f8a4a, alpha: 0.8 })
      g.rect(x - 0.5, y - 1, 1.5, 2).fill({ color: 0xf0c8d8, alpha: 0.95 })
      g.rect(x + 1.5, y - 1, 1.5, 2).fill({ color: 0xe8b0c8, alpha: 0.95 })
      g.rect(x + 0.5, y - 2, 1.5, 1.5).fill({ color: 0xf8dce8, alpha: 0.95 })
      g.rect(x + 0.5, y - 1, 1, 1).fill({ color: 0xf2d968, alpha: 0.95 })
      break
    }
    default: {
      // lá súng nổi
      g.ellipse(x + 1, y + 0.5, 3, 2).fill({ color: 0x4f8a4a, alpha: 0.9 })
      g.rect(x, y - 0.5, 1, 1).fill({ color: 0x2f5f2f, alpha: 0.5 })
      g.rect(x + 2, y + 0.5, 1, 0.5).fill({ color: 0x7fc06a, alpha: 0.5 })
      break
    }
  }
}