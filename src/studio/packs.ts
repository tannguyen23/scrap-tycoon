import type { GroundMap } from '@ground/core/grounds'
import type { GroundPack } from '@ground/core/pack'
import { MEADOW_MAP } from '@ground/packs/meadow/map'
import { MEADOW_PACK } from '@ground/packs/meadow/pack'
import { SCRAP_YARD_PACK } from '@ground/packs/scrapYard/pack'
import { SCRAP_MAP } from '@ground/packs/scrapYard/worldGrounds'

/**
 * The studio's pack registry — the hub list. Each entry is one project's ground:
 * its pack (terrains, specimens, decals, shore) and, when the project has one,
 * its site map. Adding a project is one line here plus its pack module; the
 * studio builds every preview from the selected entry, exactly like the game
 * does. (The scrap-only tabs — zones, lighting, weather — stay bound to the
 * scrap project, since those previews are game scenes, not kit output.)
 */
export interface StudioGroundPack {
  readonly id: string
  readonly label: string
  readonly pack: GroundPack
  readonly map?: GroundMap
}

export const STUDIO_GROUND_PACKS: readonly StudioGroundPack[] = [
  { id: SCRAP_YARD_PACK.id, label: SCRAP_YARD_PACK.label, pack: SCRAP_YARD_PACK, map: SCRAP_MAP },
  { id: MEADOW_PACK.id, label: MEADOW_PACK.label, pack: MEADOW_PACK, map: MEADOW_MAP },
]
