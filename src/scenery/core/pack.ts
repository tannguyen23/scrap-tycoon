import type { AmbienceSpec } from './ambience'
import type { DetailDrawer, DetailProp } from './details'
import type { LightSource } from './lighting'

/**
 * Everything the scenery kit needs to dress a project's map: the light pools, the
 * ambient-life spec (smoke points, bird lanes) and the two LOD prop layers with
 * their drawers. Same seam as the ground kit: `scenery/core` never imports a
 * pack, and a new project supplies one.
 */
export interface SceneryPack {
  readonly id: string
  readonly label: string
  /** Warm light pools: lamps, windows, fires. */
  readonly lights: readonly LightSource[]
  readonly ambience: AmbienceSpec
  readonly microProps: readonly DetailProp[]
  readonly drawMicro: DetailDrawer
  readonly nanoProps: readonly DetailProp[]
  readonly drawNano: DetailDrawer
}

export function validateSceneryPack(pack: SceneryPack): string[] {
  const errors: string[] = []
  if (!pack.id) errors.push('scenery pack id must not be empty')
  for (const light of pack.lights) {
    if (!(light.radius > 0)) errors.push(`light at ${light.x},${light.y} needs a positive radius`)
  }
  return errors
}
