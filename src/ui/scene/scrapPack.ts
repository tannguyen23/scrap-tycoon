import type { GameContent } from '@domain/types'
import { blobContour } from '@ground/core/edgeGeometry'
import { DEFAULT_BLOB_PAD } from '@ground/core/grounds'
import { SCRAP_YARD_PACK } from '@ground/packs/scrapYard/pack'
import { SCRAP_MAP, paintWorldGrounds } from '@ground/packs/scrapYard/worldGrounds'
import { WORLD_HEIGHT, WORLD_WIDTH, ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import type { ScenePack, SceneZone } from '@scene/core/pack'
import type { WaterBody } from '@scene/core/water'
import { SCRAP_SCENERY } from '@scenery/packs/scrapYard/pack'
import { courierLegsFor, createCouriers } from './couriers'
import { DETAIL_SCENES } from './focus'
import { createWeather } from './weather'

/** Zone rects + outline colours, straight from the world layout the map paints. */
function scrapZones(): Record<string, SceneZone> {
  const zones: Record<string, SceneZone> = {}
  for (const [id, layout] of Object.entries(ZONE_LAYOUTS)) {
    zones[id] = { rect: layout.rect, color: layout.style.color }
  }
  return zones
}

/**
 * The waterlines the scene animates, derived from the very blob calls the ground
 * pass paints — same rect, same pad, same seed, so a glint can never end up on
 * ground the map drew as bank.
 */
function scrapWater(): WaterBody[] {
  return SCRAP_MAP.water.map((area) => ({
    center: { x: area.rect.x + area.rect.width / 2, y: area.rect.y + area.rect.height / 2 },
    contour: blobContour(area.rect, area.pad ?? DEFAULT_BLOB_PAD, area.seed),
  }))
}

/**
 * The tone the ripples light up in: the water's own base blended part-way toward
 * its highlight. The raw highlight is near-white and reads as a bar across the
 * pond; a colour invented from scratch simply disappears into the surface.
 */
function scrapWaterCrest(): number {
  const terrain = SCRAP_YARD_PACK.terrains.find((candidate) => candidate.id === 'water')
  const bases = terrain?.bases ?? []
  const base = bases[Math.floor(bases.length / 2)] ?? 0x467ba0
  const light = terrain?.specks[0]?.[1] ?? 0xb0e2f0
  const mix = (shift: number): number => {
    const from = (base >> shift) & 0xff
    const to = (light >> shift) & 0xff
    return Math.round(from + (to - from) * 0.5) & 0xff
  }
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

/**
 * The tone a fish shows as: the water's own **shade**, so a silhouette reads as
 * being under the surface rather than painted on top of it.
 */
function scrapWaterShade(): number {
  const terrain = SCRAP_YARD_PACK.terrains.find((candidate) => candidate.id === 'water')
  return terrain?.specks[0]?.[0] ?? 0x2a5070
}

/**
 * Binds the scene kit to the scrap-yard project: its world, its ground and
 * scenery packs, its five zone scenes, the courier runs and the weather look.
 * This module is the project half of the seam — the kit half is `scene/core`.
 */
export function createScrapScenePack(content: GameContent): ScenePack {
  return {
    id: 'scrapYard',
    label: 'Scrap Yard / Đồng nát',
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    zones: scrapZones(),
    ground: { pack: SCRAP_YARD_PACK, paint: paintWorldGrounds },
    scenery: SCRAP_SCENERY,
    details: DETAIL_SCENES,
    water: { bodies: scrapWater(), crest: scrapWaterCrest(), fish: scrapWaterShade() },
    makeCouriers: () => createCouriers(courierLegsFor(content)),
    makeWeather: () => (content.weather ? createWeather({ profile: content.weather }) : null),
  }
}
