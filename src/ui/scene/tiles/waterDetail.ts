import { makeRandom } from '../random'
import { contourSteps, type GroundCanvas } from './groundCanvas'

const FOAM = 0xcfe4f5
const WET_MUD = 0x8a7550
const ERODED = 0x6f5c3e
const ERODED_DARK = 0x51422b
const DRY_PEBBLE = 0x8d8b7e
const PAD = 0x4f8a4a
const PAD_DARK = 0x3d6b39

/**
 * Shore dressing for a water clearing: a light foam line right at the waterline,
 * wet pebbles half in the water, dry ones on the bank and the odd lily pad.
 * Deliberately sparse — reeds and thick foam made ponds look overgrown.
 *
 * The soil side is water-worn: silt streaks and caved-in crumbs of bank sit along
 * the waterline, so the edge reads as eroded soil rather than a cut outline.
 */
export function paintShore(g: GroundCanvas, contour: readonly number[], seed: number): void {
  const rnd = makeRandom(seed * 89 + 3)

  for (const spot of contourSteps(contour, 6)) {
    // Bọt nước men theo mép, hơi lệch vào trong.
    if (rnd() < 0.5) {
      const d = 1 + rnd() * 2
      g.rect(
        Math.round(spot.x + spot.inwardX * d),
        Math.round(spot.y + spot.inwardY * d),
        1 + Math.round(rnd()),
        1,
      ).fill({ color: FOAM, alpha: 0.3 + rnd() * 0.2 })
    }
    // Sỏi ướt, nửa chìm trong nước.
    if (rnd() < 0.25) {
      const d = 1 + rnd() * 3
      g.rect(Math.round(spot.x + spot.inwardX * d), Math.round(spot.y + spot.inwardY * d), 1.5, 1).fill({
        color: WET_MUD,
        alpha: 0.7,
      })
    }
    // Sỏi khô nằm trên bờ.
    if (rnd() < 0.3) {
      const d = 2 + rnd() * 5
      g.rect(Math.round(spot.x - spot.inwardX * d), Math.round(spot.y - spot.inwardY * d), 1.5, 1).fill({
        color: DRY_PEBBLE,
        alpha: 0.85,
      })
    }
    // Đất bờ bị nước xói: vệt bùn và cục đất sạt men theo mép, lệch hẳn ra ngoài
    // nên đường bờ không bao giờ thẳng.
    if (rnd() < 0.5) {
      const d = 2 + rnd() * 4
      const x = Math.round(spot.x - spot.inwardX * d)
      const y = Math.round(spot.y - spot.inwardY * d)
      g.rect(x, y, 2 + Math.round(rnd() * 2), 1).fill({ color: ERODED, alpha: 0.55 + rnd() * 0.2 })
      if (rnd() < 0.45) g.rect(x + 1, y + 1, 1, 1).fill({ color: ERODED_DARK, alpha: 0.5 })
    }
    // Sỏi ướt dính thành cụm, nửa chìm ngay mép nước.
    if (rnd() < 0.35) {
      const d = rnd() * 2
      const x = Math.round(spot.x + spot.inwardX * d)
      const y = Math.round(spot.y + spot.inwardY * d)
      g.rect(x, y, 2, 1).fill({ color: WET_MUD, alpha: 0.8 })
      g.rect(x + 1, y - 1, 1, 1).fill({ color: DRY_PEBBLE, alpha: 0.7 })
    }
  }

  // Lá súng nổi, thỉnh thoảng mới có một lá.
  for (const spot of contourSteps(contour, 40)) {
    if (rnd() < 0.7) continue
    const d = 5 + rnd() * 6
    const x = Math.round(spot.x + spot.inwardX * d)
    const y = Math.round(spot.y + spot.inwardY * d)
    g.ellipse(x, y, 2.5, 1.5).fill({ color: PAD, alpha: 0.9 })
    g.rect(x - 1, y, 1, 1).fill({ color: PAD_DARK, alpha: 0.6 })
  }
}