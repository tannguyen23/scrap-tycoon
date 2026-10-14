import type { GroundPack } from '@ground/core/pack'
import type { TerrainDef } from '@ground/core/terrain'
import { paintDragMarks, paintFootprints, paintPuddle, paintRuts, paintWearPath } from './decals'
import { paintShore } from './shore'
import {
  DEBRIS_KINDS,
  FLORA_KINDS,
  WATER_KINDS,
  drawDebrisItem,
  drawFloraItem,
  drawWaterItem,
  pickDebrisKind,
  pickFloraKind,
  pickWaterKind,
} from './specimens'
import { SCRAP_TERRAINS, TERRAIN_PAIRS, type TileKind } from './terrains'

/**
 * The Scrap Tycoon ground pack: a temperate yard — grassy fields, mixed dirt,
 * ponds, gravel aprons and poured concrete. It is the reference pack: the kit
 * only ever asks for the shapes below, never for a scrap-yard module.
 */
export const SCRAP_YARD_PACK: GroundPack = {
  id: 'scrapYard',
  label: 'Scrap Yard / Đồng nát',
  terrains: SCRAP_TERRAINS,
  pairs: TERRAIN_PAIRS,
  specimens: {
    flora: { count: FLORA_KINDS, pick: pickFloraKind, draw: drawFloraItem },
    debris: { count: DEBRIS_KINDS, pick: pickDebrisKind, draw: drawDebrisItem },
    water: { count: WATER_KINDS, pick: pickWaterKind, draw: drawWaterItem },
  },
  decals: {
    puddle: paintPuddle,
    dragMarks: paintDragMarks,
    wear: paintWearPath,
    footprints: paintFootprints,
    ruts: paintRuts,
  },
  shore: paintShore,
}

/** One scrap terrain by id — the studio's sheet/seam builders need the defs. */
export function scrapTerrain(id: TileKind): TerrainDef {
  const def = SCRAP_TERRAINS.find((terrain) => terrain.id === id)
  if (!def) throw new Error(`scrap pack has no terrain "${id}"`)
  return def
}
