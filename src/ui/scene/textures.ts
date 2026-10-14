import type { Graphics } from 'pixi.js'
import { DECOR_SPECIMENS } from './decorItems'

export interface DecorPlacement {
  /** Key into `DECOR_SPECIMENS` — a typo is caught by `tests/worldDecor.test.ts`. */
  key: string
  x: number
  y: number
}

const SPECIMENS = new Map(DECOR_SPECIMENS.map((specimen) => [specimen.key, specimen]))

/**
 * Hand-placed decor across the open ground. Placement is DATA so the tests can
 * walk it: nothing may stand inside a zone rect — each zone has its own art,
 * and the props here only dress the open map between them (plus the fence
 * keeps the two apart anyway). Every item's art lives in `decorItems.ts`, the
 * same catalog the studio lists.
 */
export const DECOR_PLACEMENTS: readonly DecorPlacement[] = [
  // Vành cây quanh map (hai tông xen kẽ cho đỡ đơn điệu).
  { key: 'tree0', x: 170, y: 30 },
  { key: 'tree1', x: 330, y: 24 },
  { key: 'tree0', x: 470, y: 26 },
  { key: 'tree1', x: 560, y: 26 },
  { key: 'tree0', x: 1030, y: 26 },
  { key: 'tree1', x: 950, y: 30 },
  { key: 'tree0', x: 1100, y: 24 },
  { key: 'tree1', x: 1230, y: 34 },
  { key: 'tree0', x: 60, y: 366 },
  { key: 'tree1', x: 60, y: 490 },
  { key: 'tree0', x: 48, y: 620 },
  { key: 'tree1', x: 420, y: 700 },
  { key: 'tree0', x: 560, y: 694 },
  { key: 'tree1', x: 700, y: 704 },
  { key: 'tree0', x: 1000, y: 700 },
  { key: 'tree1', x: 1200, y: 700 },
  { key: 'tree0', x: 1240, y: 300 },
  { key: 'tree1', x: 1230, y: 490 },
  { key: 'tree0', x: 560, y: 320 },
  { key: 'tree1', x: 980, y: 490 },

  { key: 'bush0', x: 430, y: 300 },
  { key: 'bush1', x: 430, y: 356 },
  { key: 'bush0', x: 520, y: 340 },
  { key: 'bush1', x: 556, y: 196 },
  { key: 'bush0', x: 900, y: 330 },
  { key: 'bush1', x: 830, y: 220 },
  { key: 'bush0', x: 960, y: 240 },
  { key: 'bush1', x: 1090, y: 250 },
  { key: 'bush0', x: 1130, y: 470 },
  { key: 'bush1', x: 1180, y: 240 },
  { key: 'bush0', x: 600, y: 470 },
  { key: 'bush1', x: 760, y: 500 },
  { key: 'bush0', x: 900, y: 470 },
  { key: 'bush1', x: 1080, y: 664 },
  { key: 'bush0', x: 360, y: 520 },
  { key: 'bush1', x: 170, y: 360 },

  { key: 'stump', x: 520, y: 60 },
  { key: 'stump', x: 760, y: 240 },
  { key: 'stump', x: 1000, y: 260 },
  { key: 'stump', x: 1180, y: 540 },
  { key: 'stump', x: 400, y: 470 },
  { key: 'stump', x: 660, y: 620 },
  { key: 'stump', x: 520, y: 640 },

  { key: 'log', x: 400, y: 368 },
  { key: 'log', x: 900, y: 470 },
  { key: 'log', x: 660, y: 300 },
  { key: 'crates', x: 1180, y: 180 },
  { key: 'crates', x: 200, y: 360 },

  { key: 'rock', x: 420, y: 238 },
  { key: 'rockBig', x: 1010, y: 240 },
  { key: 'rockSmall', x: 1130, y: 200 },
  { key: 'rock', x: 760, y: 660 },
  { key: 'rock', x: 300, y: 500 },
  { key: 'rockCluster', x: 460, y: 200 },
  { key: 'rockCluster', x: 480, y: 300 },
  { key: 'rockCluster', x: 1180, y: 560 },

  { key: 'barrel0', x: 300, y: 366 },
  { key: 'barrel1', x: 1120, y: 470 },
  { key: 'barrel0', x: 560, y: 600 },

  { key: 'tire', x: 760, y: 240 },
  { key: 'tire', x: 420, y: 320 },
  { key: 'tireStack', x: 210, y: 470 },
  { key: 'tireStack', x: 800, y: 600 },

  { key: 'pipe', x: 860, y: 300 },
  { key: 'pipe', x: 520, y: 600 },
  { key: 'pallets', x: 1180, y: 360 },
  { key: 'pallets', x: 660, y: 660 },

  { key: 'sign', x: 330, y: 366 },
  { key: 'sign', x: 880, y: 480 },

  { key: 'tuft', x: 130, y: 366 },
  { key: 'tuft', x: 620, y: 210 },
  { key: 'tuft', x: 1150, y: 620 },
  { key: 'tuft', x: 368, y: 662 },

  { key: 'scrap', x: 700, y: 330 },
  { key: 'scrap', x: 1150, y: 300 },
  { key: 'scrap', x: 1180, y: 470 },
  { key: 'scrap', x: 620, y: 620 },
  { key: 'scrap', x: 390, y: 668 },
  { key: 'scrap', x: 900, y: 668 },
]

/** Places every specimen of `DECOR_PLACEMENTS` (map and studio draw from one list). */
export function drawDecor(g: Graphics): void {
  for (const placement of DECOR_PLACEMENTS) {
    SPECIMENS.get(placement.key)?.draw(g, placement.x, placement.y)
  }
}
