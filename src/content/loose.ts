import { Decimal } from '@core/num'
import type { LooseSpawnDef } from '@domain/types'
import { SCRAP_ITEM } from './items'

/**
 * Debris the yards scatter on their own floor. Each piece lies there until the
 * player walks up and picks it up (F), and the whole lot is TRANSIENT — a reload
 * re-scatters the yards. These numbers are the pace knob for the opening loop:
 * scatter slower than the old "hold F anywhere" poke, so gathering means walking.
 */
export const LOOSE_SPAWNS: readonly LooseSpawnDef[] = [
  {
    zone: 'alley',
    item: SCRAP_ITEM,
    amount: new Decimal(2),
    secondsPerItem: 1.5,
    cap: 12,
  },
]
