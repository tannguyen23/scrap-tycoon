import type { Graphics } from 'pixi.js'
import {
  drawBarrel,
  drawBush,
  drawCrateStack,
  drawLog,
  drawPallets,
  drawPipe,
  drawRock,
  drawRockCluster,
  drawScrapPile,
  drawSign,
  drawStump,
  drawTree,
  drawTire,
  drawTireStack,
  drawTuft,
} from './decorItems'

/**
 * Hand-placed decor across the open ground. Placement only — every item's art
 * lives in `decorItems.ts` (the same catalog the studio lists), so adding a new
 * prop means adding a drawer there plus a call here.
 */
export function drawDecor(g: Graphics): void {
  // Vành cây quanh map (hai tông xen kẽ cho đỡ đơn điệu).
  drawTree(g, 170, 30, 0)
  drawTree(g, 330, 24, 1)
  drawTree(g, 470, 26, 0)
  drawTree(g, 640, 22, 1)
  drawTree(g, 790, 26, 0)
  drawTree(g, 950, 30, 1)
  drawTree(g, 1100, 24, 0)
  drawTree(g, 1230, 34, 1)
  drawTree(g, 50, 320, 0)
  drawTree(g, 60, 470, 1)
  drawTree(g, 48, 620, 0)
  drawTree(g, 420, 700, 1)
  drawTree(g, 560, 694, 0)
  drawTree(g, 700, 704, 1)
  drawTree(g, 1000, 700, 0)
  drawTree(g, 1200, 700, 1)
  drawTree(g, 1240, 300, 0)
  drawTree(g, 1230, 480, 1)
  drawTree(g, 560, 320, 0)
  drawTree(g, 980, 470, 1)

  drawBush(g, 340, 240, 0)
  drawBush(g, 430, 300, 1)
  drawBush(g, 520, 340, 0)
  drawBush(g, 660, 180, 1)
  drawBush(g, 720, 120, 0)
  drawBush(g, 830, 220, 1)
  drawBush(g, 960, 240, 0)
  drawBush(g, 1090, 250, 1)
  drawBush(g, 1130, 470, 0)
  drawBush(g, 1180, 240, 1)
  drawBush(g, 600, 470, 0)
  drawBush(g, 760, 500, 1)
  drawBush(g, 900, 470, 0)
  drawBush(g, 1080, 650, 1)
  drawBush(g, 360, 520, 0)
  drawBush(g, 240, 300, 1)

  drawStump(g, 330, 160)
  drawStump(g, 600, 60)
  drawStump(g, 760, 240)
  drawStump(g, 1000, 260)
  drawStump(g, 1180, 540)
  drawStump(g, 400, 470)
  drawStump(g, 660, 620)
  drawStump(g, 520, 640)

  drawLog(g, 250, 210)
  drawLog(g, 900, 470)
  drawLog(g, 660, 300)
  drawCrateStack(g, 1180, 180)
  drawCrateStack(g, 200, 360)

  drawRock(g, 390, 240, 1)
  drawRock(g, 1010, 240, 1.1)
  drawRock(g, 1130, 200, 0.9)
  drawRock(g, 760, 660, 1)
  drawRock(g, 300, 500, 1)
  drawRockCluster(g, 700, 180)
  drawRockCluster(g, 480, 300)
  drawRockCluster(g, 1180, 560)

  drawBarrel(g, 350, 300)
  drawBarrel(g, 1120, 470, 0x8a6a52)
  drawBarrel(g, 560, 600)

  drawTire(g, 760, 240)
  drawTire(g, 420, 320)
  drawTireStack(g, 210, 470)
  drawTireStack(g, 980, 600)

  drawPipe(g, 860, 300)
  drawPipe(g, 520, 600)
  drawPallets(g, 1180, 360)
  drawPallets(g, 660, 660)

  drawSign(g, 300, 200)
  drawSign(g, 880, 470)

  drawTuft(g, 180, 220)
  drawTuft(g, 700, 90)
  drawTuft(g, 1150, 620)
  drawTuft(g, 350, 660)

  drawScrapPile(g, 700, 330)
  drawScrapPile(g, 1150, 300)
  drawScrapPile(g, 1180, 470)
  drawScrapPile(g, 620, 620)
  drawScrapPile(g, 360, 660)
  drawScrapPile(g, 900, 660)
}