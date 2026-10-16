import { ZONE_LAYOUTS, type ZoneRect } from '@ground/packs/scrapYard/worldLayout'
import { Container, Graphics } from 'pixi.js'
import type { TilePainter } from '@ground/core/painter'
import { paintPuddle, paintStain, paintWearPath } from '@ground/packs/scrapYard/decals'
import { drawZoneRing } from '../fence'
import { Particles, depthArt, sortByDepth } from '../parts'
import { createPopups } from '../popups'
import { drawProp, type ZoneProp } from '../props'
import type { DetailScene, DetailSceneState } from '@scene/core/types'
import { drawBottle, drawPallet, drawTrashBag, drawWeedTuft } from '../alley/sprites'

/**
 * Vật ĐỨNG của bãi đồ trắng — nguồn DUY NHẤT cho cả art lẫn đế va chạm (`walkable` dựng
 * hộp chặn từ chính danh sách này). Pallet NẰM không khai: bước qua được.
 */
export const APPLIANCES_PROPS: readonly ZoneProp[] = [
  { kind: 'fridge', x: 60, y: 110 },
  { kind: 'fridge', x: 250, y: 110 },
  { kind: 'washer', x: 150, y: 96 },
  { kind: 'washer', x: 360, y: 100 },
  { kind: 'brokenTv', x: 300, y: 90 },
  // Không đặt ngay tâm thửa: tâm là chỗ hẹn gặp của test "lòng thửa phải đứng được".
  { kind: 'brokenTv', x: 160, y: 140 },
  { kind: 'crate', x: 330, y: 96 },
  { kind: 'heap', x: 358, y: 60, variant: 5 },
]

/**
 * Bãi đồ trắng — thửa BẮC-ĐÔNG của bãi ve chai: thấp mà dài, tủ lạnh/máy giặt/TV xếp
 * thành hàng, pallet và thùng gỗ chen giữa. Chưa có thợ (chỗ cho gameplay sau này),
 * nên scene chỉ có đồ TĨNH + lớp `actors` để người chơi đi vào vẫn được y-sort.
 */
export function createAppliancesDetail(rect: ZoneRect, tiles: TilePainter): DetailScene {
  const root = new Container()
  root.position.set(rect.x, rect.y)
  const width = rect.width
  const height = rect.height

  tiles.scatter(root, { x: 0, y: 0, width, height }, 311, 'debris', 30)

  const decals = new Graphics()
  // Lối vào từ cổng nam chạy dọc bãi, hai bên là hàng máy.
  paintWearPath(decals, [{ x: 110, y: 154 }, { x: 130, y: 120 }, { x: 190, y: 96 }], { seed: 321, strength: 0.6 })
  paintWearPath(decals, [{ x: 130, y: 120 }, { x: 300, y: 104 }], { seed: 322, strength: 0.45 })
  paintStain(decals, { x: 250, y: 130 }, { radius: 12, soot: true, seed: 323 })
  paintPuddle(decals, 280, 128, 6, 2.4, 324)
  root.addChild(decals)

  const actors = new Container()
  actors.label = 'actors'

  const props = new Graphics()
  for (const tuft of [
    [16, 16],
    [386, 16],
    [16, 146],
    [240, 18],
    [298, 146],
    [386, 140],
  ] as const) {
    drawWeedTuft(props, tuft[0], tuft[1])
  }
  for (const bottle of [
    [200, 140, 0, true],
    [270, 132, 2, false],
    [70, 60, 1, true],
  ] as const) {
    drawBottle(props, bottle[0], bottle[1], bottle[2], bottle[3])
  }
  drawTrashBag(props, 250, 144, 5)
  drawTrashBag(props, 274, 148, 4.5)
  root.addChild(props)

  // Mỗi món ĐỨNG là một node depth theo đường chân của nó — vẽ từ ĐÚNG danh sách mà
  // `walkable` dựng đế chặn.
  for (const prop of APPLIANCES_PROPS) drawProp(depthArt(actors, prop.y), prop)

  // Pallet NẰM: bước qua được nên không khai đế.
  drawPallet(depthArt(actors, 144), 210, 144)
  drawPallet(depthArt(actors, 146), 30, 146)

  const layout = ZONE_LAYOUTS.appliances
  if (layout) {
    const ring = layout.outline ?? []
    const top = Math.min(...ring.map((point) => point.y))
    const bottom = Math.max(...ring.map((point) => point.y))
    drawZoneRing(depthArt(actors, top), layout, 'back')
    drawZoneRing(depthArt(actors, bottom), layout, 'front')
  }

  const particles = new Particles()
  const popups = createPopups()
  root.addChild(actors, particles.container, popups.container)

  return {
    root,
    setState: (state: DetailSceneState) => popups.setLabels(state.labels),
    update: (dt: number) => {
      sortByDepth(actors)
      particles.update(dt)
      popups.update(dt)
    },
  }
}
