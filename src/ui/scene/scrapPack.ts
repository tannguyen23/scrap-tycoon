import type { GameContent } from '@domain/types'
import { SCRAP_YARD_PACK } from '@ground/packs/scrapYard/pack'
import { paintWorldGrounds } from '@ground/packs/scrapYard/worldGrounds'
import { WORLD_HEIGHT, WORLD_WIDTH, ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import type { ScenePack, SceneZone } from '@scene/core/pack'
import type { DetailSceneFactory } from '@scene/core/types'
import { SCRAP_SCENERY } from '@scenery/packs/scrapYard/pack'
import { Container } from 'pixi.js'
import { courierLegsFor, createCouriers } from './couriers'
import { DETAIL_SCENES } from './focus'
import { createPlayer, type PlayerLayer } from './player'
import { scrapWaterBodies } from './waterBodies'
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
 * The `actors` layer every zone scene keeps its depth-sorted bodies in
 * (`tests/depthSort.test.ts` finds it the same way). The player's body is handed
 * to it while standing in that yard, so it walks behind the yard's own props.
 */
function actorHost(root: Container): Container | null {
  for (const child of root.children) {
    if (child.label === 'actors') return child
  }
  return null
}

export interface ScrapScene {
  readonly pack: ScenePack
  /** The player layer — non-null once the kit has mounted the pack. */
  player(): PlayerLayer | null
}

/**
 * Binds the scene kit to the scrap-yard project: its world, its ground and
 * scenery packs, its five zone scenes, the courier runs, the weather look and the
 * player. This module is the project half of the seam — the kit half is
 * `scene/core`.
 */
export function createScrapScene(content: GameContent): ScrapScene {
  const hosts: Record<string, Container> = {}
  const details: Record<string, DetailSceneFactory> = {}
  for (const [zoneId, factory] of Object.entries(DETAIL_SCENES)) {
    // Wrap each factory so the yard's depth layer is caught as it is built —
    // the kit builds the detail scenes before it asks for the player.
    details[zoneId] = (rect, painter, services) => {
      const scene = factory(rect, painter, services)
      const host = actorHost(scene.root)
      if (host) hosts[zoneId] = host
      return scene
    }
  }

  let player: PlayerLayer | null = null
  const pack: ScenePack = {
    id: 'scrapYard',
    label: 'Scrap Yard / Đồng nát',
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    // The canvas stays one screen: the world is painted in chunks and panned by
    // the camera, so growing the map never grows the canvas.
    viewport: { width: 1280, height: 720 },
    zones: scrapZones(),
    ground: { pack: SCRAP_YARD_PACK, paint: paintWorldGrounds },
    scenery: SCRAP_SCENERY,
    details,
    water: { bodies: scrapWaterBodies(), crest: scrapWaterCrest(), fish: scrapWaterShade() },
    makePlayer: () => (player = createPlayer({ hosts })),
    makeCouriers: () => createCouriers(courierLegsFor(content)),
    makeWeather: () => (content.weather ? createWeather({ profile: content.weather }) : null),
  }
  return { pack, player: () => player }
}

export function createScrapScenePack(content: GameContent): ScenePack {
  return createScrapScene(content).pack
}
