import type { ZoneId } from '@domain/types'
import type { TileKind } from './tiles/terrain'

/**
 * Design-space grid. The art is authored at double density (1 design px has
 * become the finest feature step), so the canvas maps 1:1 and every object
 * carries twice the pixels it used to.
 */
export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

export const CANVAS_SCALE = 1
export const VIEW_WIDTH = WORLD_WIDTH * CANVAS_SCALE
export const VIEW_HEIGHT = WORLD_HEIGHT * CANVAS_SCALE

export interface ZoneRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ZoneStyle {
  /** Pixi fill colour. */
  color: number
  /** Matching CSS colour for the HUD zone cards. */
  css: string
}

export interface ZoneLayout {
  rect: ZoneRect
  style: ZoneStyle
}

export const DEFAULT_ZONE_STYLE: ZoneStyle = { color: 0x8b93a7, css: '#8b93a7' }

/**
 * Map layout for the scrap-yard zones (design space). Keyed by the same zone
 * ids content uses; each zone's detail scene is authored for exactly this rect.
 * Zones keep their authored size — the roomier map goes into the open ground
 * between them (clearings, ponds, tree lines).
 */
export const ZONE_LAYOUTS: Record<string, ZoneLayout> = {
  alley: {
    style: { color: 0x7cc45c, css: '#7cc45c' },
    rect: { x: 80, y: 70, width: 224, height: 124 },
  },
  route: {
    style: { color: 0xffb454, css: '#ffb454' },
    rect: { x: 0, y: 380, width: WORLD_WIDTH, height: 64 },
  },
  depot: {
    style: { color: 0x7fa4d9, css: '#7fa4d9' },
    rect: { x: 80, y: 560, width: 264, height: 88 },
  },
  gate: {
    style: { color: 0xf08a6a, css: '#f08a6a' },
    rect: { x: 860, y: 548, width: 256, height: 92 },
  },
}

export function zoneStyle(zoneId: ZoneId): ZoneStyle {
  return ZONE_LAYOUTS[zoneId]?.style ?? DEFAULT_ZONE_STYLE
}

/**
 * Asphalt links between zones (driveways down to the yard + the gate exit lane).
 * Painted from here so the map and the studio show the exact same connections.
 */
export const CONNECTORS: readonly ZoneRect[] = [
  { x: 216, y: 444, width: 36, height: 116 },
  { x: 924, y: 444, width: 36, height: 104 },
  { x: 1116, y: 576, width: 164, height: 32 },
]

export interface PatchArea {
  rect: ZoneRect
  /** Terrain of the patch (default dirt). */
  kind?: TileKind
  /** Terrain it sits in — drives the lip of its edge tiles (default grass). */
  outside?: TileKind
  /**
   * >0 makes the patch a raised plateau: its edges become walls (sunlit crest,
   * wall face with strata, shadow cast onto the lower ground). Visual only.
   */
  elevation?: number
}

/**
 * Ground patches on the open map: phase-2 room, the muddy wallow around a pond,
 * the gravel heap dug into one of the dirt clearings and a raised dirt platform
 * by the alley (the elevation demo).
 */
export const CLEARINGS: readonly PatchArea[] = [
  { rect: { x: 480, y: 60, width: 120, height: 70 }, elevation: 1 },
  { rect: { x: 1030, y: 300, width: 130, height: 80 } },
  { rect: { x: 620, y: 470, width: 100, height: 60 } },
  { rect: { x: 960, y: 620, width: 90, height: 54 } },
  { rect: { x: 418, y: 468, width: 172, height: 128 } },
  { rect: { x: 1062, y: 320, width: 66, height: 40 }, kind: 'gravel', outside: 'dirt', elevation: 1 },
]

export interface WaterArea {
  rect: ZoneRect
  /**
   * Terrain the pond sits in — drives its shore: grass lip in the fields, packed
   * mud where a wallow is dug into dirt (the water↔dirt transition pair).
   */
  outside?: TileKind
}

/**
 * Standing water on the map: rain ponds, a mud wallow dug into a dirt patch and
 * one at the gate. Painted as organic water blobs — full autotile shore, foam,
 * reeds, floating junk and water plants — not as flat ellipses.
 */
export const WATER_AREAS: readonly WaterArea[] = [
  { rect: { x: 880, y: 120, width: 170, height: 100 } },
  { rect: { x: 560, y: 240, width: 108, height: 66 } },
  { rect: { x: 360, y: 120, width: 70, height: 44 } },
  { rect: { x: 440, y: 500, width: 120, height: 70 }, outside: 'dirt' },
  { rect: { x: 700, y: 610, width: 76, height: 46 } },
]