import type { ZoneId } from '@domain/types'
import { createAlleyDetail } from './alley/scene'
import { createDepotDetail } from './depot/scene'
import { createGateDetail } from './gate/scene'
import { createRecycleDetail } from './recycle/scene'
import { createRouteDetail } from './route/scene'
import type { DetailSceneFactory } from '@scene/core/types'

/**
 * Detail scene per zone id. Each zone lives in its own folder with the same
 * three-file split as the map level: `sprites.ts` (art), `actors.ts`
 * (animation state machines), `scene.ts` (props + assembly).
 *
 * Zones without a factory still get the camera zoom and dim treatment; they
 * just keep their map-level art.
 */
const FACTORIES: Record<ZoneId, DetailSceneFactory> = {
  alley: createAlleyDetail,
  recycle: createRecycleDetail,
  route: createRouteDetail,
  depot: createDepotDetail,
  gate: createGateDetail,
}

/** The registry a `ScenePack` hands the kit. */
export const DETAIL_SCENES: Readonly<Record<string, DetailSceneFactory>> = FACTORIES

export function detailSceneFor(zoneId: ZoneId): DetailSceneFactory | undefined {
  return FACTORIES[zoneId]
}
