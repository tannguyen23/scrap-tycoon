import { ZONE_LAYOUTS, type ZoneRect } from '@ground/packs/scrapYard/worldLayout'
import { Container, Graphics } from 'pixi.js'
import type { TilePainter } from '@ground/core/painter'
import { paintRuts, paintStain, paintWearPath } from '@ground/packs/scrapYard/decals'
import { drawZoneRing } from '../fence'
import { Particles, depthArt, sortByDepth } from '../parts'
import { createPopups } from '../popups'
import { drawProp, type ZoneProp } from '../props'
import type { DetailScene, DetailSceneState } from '@scene/core/types'
import { drawBottle, drawFlatTire, drawWeedTuft } from '../alley/sprites'

/**
 * Vật ĐỨNG của bãi lốp — nguồn DUY NHẤT cho cả art lẫn đế va chạm (`walkable` dựng hộp
 * chặn từ chính danh sách này). Lốp NẰM không khai: bước qua được.
 */
export const TIRES_PROPS: readonly ZoneProp[] = [
  { kind: 'tireStack', x: 40, y: 60, variant: 4 },
  { kind: 'tireStack', x: 120, y: 96, variant: 3 },
  { kind: 'tireStack', x: 70, y: 150, variant: 5 },
  { kind: 'tireStack', x: 50, y: 240, variant: 4 },
  { kind: 'leaningTire', x: 160, y: 56 },
  { kind: 'leaningTire', x: 110, y: 260 },
  { kind: 'leaningTire', x: 30, y: 112 },
  { kind: 'leaningSheet', x: 150, y: 300 },
  { kind: 'heap', x: 60, y: 290, variant: 6 },
]

/**
 * Bãi lốp — thửa TÂY-BẮC của bãi ve chai: hẹp mà dài, xếp lốp theo hàng và theo chồng,
 * một đống sắt vụn lẫn vào, rãnh lốp hằn trên nền. Chưa có thợ (chỗ cho gameplay sau
 * này), nên scene chỉ có đồ TĨNH + lớp `actors` để người chơi đi vào vẫn được y-sort.
 */
export function createTiresDetail(rect: ZoneRect, tiles: TilePainter): DetailScene {
  const root = new Container()
  root.position.set(rect.x, rect.y)
  const width = rect.width
  const height = rect.height

  tiles.scatter(root, { x: 0, y: 0, width, height }, 211, 'debris', 30)

  const decals = new Graphics()
  // Rãnh lốp: xe đẩy lốp vào theo lối cổng đông rồi vòng qua các chồng.
  paintRuts(decals, [{ x: 186, y: 316 }, { x: 120, y: 280 }, { x: 110, y: 220 }], { seed: 221, strength: 0.6 })
  paintRuts(decals, [{ x: 60, y: 260 }, { x: 60, y: 120 }], { seed: 222, strength: 0.45 })
  paintStain(decals, { x: 96, y: 96 }, { radius: 12, soot: true, seed: 223 })
  paintWearPath(decals, [{ x: 186, y: 316 }, { x: 130, y: 250 }], { seed: 224, strength: 0.5 })
  root.addChild(decals)

  const actors = new Container()
  actors.label = 'actors'

  const props = new Graphics()
  for (const tuft of [
    [16, 16],
    [164, 16],
    [16, 286],
    [112, 336],
    [160, 340],
  ] as const) {
    drawWeedTuft(props, tuft[0], tuft[1])
  }
  for (const bottle of [
    [40, 210, 1, true],
    [150, 150, 2, false],
    [70, 320, 0, true],
  ] as const) {
    drawBottle(props, bottle[0], bottle[1], bottle[2], bottle[3])
  }
  root.addChild(props)

  // Mỗi món ĐỨNG là một node depth theo đường chân của nó — vẽ từ ĐÚNG danh sách mà
  // `walkable` dựng đế chặn.
  for (const prop of TIRES_PROPS) drawProp(depthArt(actors, prop.y), prop)

  // Lốp NẰM: bước qua được nên không khai đế.
  drawFlatTire(depthArt(actors, 200), 30, 200, 9)
  drawFlatTire(depthArt(actors, 122), 150, 122, 7.4)

  const layout = ZONE_LAYOUTS.tires
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
