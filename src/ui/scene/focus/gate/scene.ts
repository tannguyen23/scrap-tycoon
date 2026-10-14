import { ZONE_LAYOUTS, type ZoneRect } from '../../zoneLayout'
import { Container, Graphics } from 'pixi.js'
import type { TilePainter } from '@ground/core/painter'
import { paintFootprints, paintPuddle, paintStain } from '@ground/packs/scrapYard/decals'
import { playSound } from '@ui/sound/player'
import { CALM_WIND, type Wind } from '../../weather'
import { drawZoneFence } from '../fence'
import { Particles, SHADOW } from '../parts'
import { createPopups } from '../popups'
import type { DetailScene, DetailSceneState } from '../types'
import { LANE_Y, createTruck, type TruckActor } from './actors'
import { drawCrateStack } from './sprites'

const CAP = 2
const MAX_CRATES = 8
/** Chồng kiện chờ bốc lên xe ở cổng bắc (local; world 942, 572). */
const CRATE_STACK = { x: 82, y: 24 }

/** Detailed city gate: booth, waving flags, boom barrier + trucks loading/departing. */
export function createGateDetail(rect: ZoneRect, tiles: TilePainter): DetailScene {
  const root = new Container()
  root.position.set(rect.x, rect.y)
  const width = rect.width

  tiles.paintBlob(root, { x: 0, y: 0, width, height: rect.height }, 'dirt', 404, 16, 'gravel')
  // Làn nhựa trong sân: dùng paintPath với môi đất nên mép làn bị đất/sỏi lấn, mặt
  // nhựa mòn dần vào sân — không còn slab vuông vức.
  tiles.paintPath(root, { x: 80, y: 28, width: width - 80, height: 36 }, 'asphalt', 405, 'dirt', 14, 20)
  tiles.scatter(root, { x: 0, y: 0, width, height: rect.height }, 414, 'debris', 30)

  // Dấu vết sử dụng: vết dầu ở chỗ xe tải đỗ và trước chòi gác, vết chân từ
  // chòi ra tới làn đường, một vũng nước bên lề.
  const decals = new Graphics()
  paintStain(decals, { x: 104, y: 52 }, { radius: 16, seed: 411 })
  paintStain(decals, { x: 60, y: 70 }, { radius: 12, seed: 412 })
  paintFootprints(decals, [{ x: 52, y: 64 }, { x: 118, y: 52 }], { seed: 421, strength: 0.8 })
  paintPuddle(decals, 140, 76, 5, 2.2, 431)
  root.addChild(decals)

  const props = new Graphics()
  // đường xuất
  props.rect(80, 28, width - 80, 1).fill(0x2f333b)
  props.rect(80, 63, width - 80, 1).fill(0x2f333b)
  for (let x = 92; x < width; x += 28) {
    props.rect(x, LANE_Y - 0.5, 12, 1).fill(0x5b626d)
  }
  props.rect(176, 30, 2.4, 32).fill({ color: 0xf0e6d2, alpha: 0.3 })
  // vệt dầu + lá rụng
  props.ellipse(140, 54, 8, 3).fill({ color: 0x1f2126, alpha: 0.2 })
  props.rect(240, 64, 2, 2).fill({ color: 0xa3804f, alpha: 0.8 })
  props.rect(104, 26, 2, 1).fill({ color: 0xa3804f, alpha: 0.8 })
  // chòi gác — tường nam nhìn thấy + mái nhô lên (chiều cao giả)
  props.rect(16, 24, 32, 18).fill(0x5c6672)
  props.rect(16, 41, 32, 1).fill(0x454d59)
  props.rect(20, 27, 10, 8).fill({ color: 0xcfe0ef, alpha: 0.85 })
  props.rect(34, 27, 1, 12).fill({ color: 0x000000, alpha: 0.15 })
  props.rect(48, 16, 10, 26).fill(0x4d5560)
  props.rect(48, 16, 1, 26).fill({ color: 0x000000, alpha: 0.2 })
  props.rect(16, 4, 32, 22).fill(0x6f7a88)
  props.rect(16, 4, 32, 2).fill(0x8b95a3)
  props.rect(16, 25, 32, 1).fill({ color: 0x000000, alpha: 0.2 })
  // trụ cổng
  props.rect(204, 18, 6, 14).fill(0xa4aab6)
  props.rect(204, 58, 6, 14).fill(0xa4aab6)
  props.rect(203, 16, 8, 3).fill(0xb4bac8)
  props.rect(203, 56, 8, 3).fill(0xb4bac8)
  // biển cổng
  props.rect(198, 12, 22, 7).fill(0xf08a6a)
  props.rect(200, 14, 8, 1.6).fill({ color: 0xf5ecd6, alpha: 0.9 })
  props.rect(210, 14, 6, 1.6).fill({ color: 0xf5ecd6, alpha: 0.9 })
  // cọc tiêu chỉ làn
  drawCone(props, 168, 72)
  drawCone(props, 176, 24)
  root.addChild(props)

  // Hàng rào bao sân: cổng bắc cho làn nhựa vào, cổng đông cho làn xuất hàng.
  const fence = new Graphics()
  drawZoneFence(fence, rect, ZONE_LAYOUTS.gate?.fenceOpenings)
  root.addChild(fence)

  // cờ trên trụ cổng (2 frame vẫy)
  const flags = new Graphics()
  const flagWaveA = new Graphics()
  flagWaveA.rect(192, 4, 5, 3).fill(0xc0392b)
  flagWaveA.rect(210, 4, 5, 3).fill(0xd9a05b)
  const flagWaveB = new Graphics()
  flagWaveB.rect(192, 5, 5, 2).fill(0xc0392b)
  flagWaveB.rect(210, 5, 5, 2).fill(0xd9a05b)
  flags.addChild(flagWaveA, flagWaveB)
  root.addChild(flags)

  // thanh chắn (boom barrier)
  const barrier = new Graphics()
  root.addChild(barrier)
  let barrierOpen = false
  const drawBarrier = (open: boolean): void => {
    if (open === barrierOpen) return
    barrierOpen = open
    playSound('barrier')
    barrier.clear()
    barrier.rect(191, 68, 4, 4).fill(0x3d4356)
    if (open) {
      barrier.rect(180, 69, 24, 1.6).fill(0xe07a5f)
      barrier.rect(180, 69, 24, 0.6).fill({ color: 0xffffff, alpha: 0.6 })
    } else {
      barrier.rect(191.8, 32, 1.6, 36).fill(0xe07a5f)
      barrier.rect(191.8, 32, 0.6, 36).fill({ color: 0xffffff, alpha: 0.6 })
    }
  }
  drawBarrier(false)

  const actors = new Container()
  const particles = new Particles()
  const popups = createPopups()
  root.addChild(actors, particles.container, popups.container)

  // Kho của khu: chồng kiện bên cổng bắc, lớn dần theo tồn `crate` thật; dấu đỏ
  // nhấp nháy khi bin đầy (chặng đóng hàng phía trước bị nghẽn).
  const warehouse = new Container()
  warehouse.label = 'warehouse'
  root.addChild(warehouse)
  const crateFullMark = new Graphics().rect(CRATE_STACK.x - 2, CRATE_STACK.y - 46, 4, 4).fill(0xd9534f)
  crateFullMark.visible = false
  root.addChild(crateFullMark)
  let crateLevel = -1
  let stock01 = -1

  const trucks: TruckActor[] = []
  let desired = 0
  let lastFlagFrame = -1
  let ambient: Wind = CALM_WIND

  const setState = (state: DetailSceneState): void => {
    popups.setLabels(state.labels)
    desired = Math.min(state.workers, CAP)
    while (trucks.length < desired) {
      const truck = createTruck(trucks.length, width)
      trucks.push(truck)
      actors.addChild(truck.sprite.container)
    }
    for (let i = 0; i < trucks.length; i++) {
      const truck = trucks[i]
      if (truck) truck.sprite.container.visible = i < desired
    }

    stock01 = state.stock01
    const crateGoal = stock01 < 0 ? 0 : Math.max(0, Math.min(MAX_CRATES, Math.ceil(stock01 * MAX_CRATES)))
    if (crateGoal !== crateLevel) {
      drawCrateStack(warehouse, CRATE_STACK.x, CRATE_STACK.y, crateGoal)
      crateLevel = crateGoal
    }
    crateFullMark.visible = stock01 >= 0.99
  }

  const update = (dt: number, elapsed: number): void => {
    crateFullMark.visible = stock01 >= 0.99 && Math.floor(elapsed * 2) % 2 === 0
    // Gió mạnh thì cờ vẫy nhanh hơn — vẫn đúng 2 frame như cũ.
    const flagFrame = Math.floor(elapsed * 2.5 * (1 + ambient.strength * 1.6)) % 2
    if (flagFrame !== lastFlagFrame) {
      lastFlagFrame = flagFrame
      const first = flags.children[0]
      const second = flags.children[1]
      if (first && second) {
        first.visible = flagFrame === 0
        second.visible = flagFrame === 1
      }
    }

    let anyDeparting = false
    for (let i = 0; i < desired; i++) {
      const truck = trucks[i]
      if (!truck) continue
      truck.update(dt, particles, popups, ambient)
      if (truck.getPhase() === 'depart' && truck.getX() > 80) anyDeparting = true
    }
    drawBarrier(anyDeparting)
    particles.update(dt)
    popups.update(dt)
  }

  return {
    root,
    setState,
    update,
    setAmbient: (wind) => {
      ambient = wind
    },
  }
}

function drawCone(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 1, y + 2, 5.2, 2.8).fill(SHADOW)
  g.rect(x - 4.8, y - 1, 9.6, 4.8).fill(0xd9784f)
  g.rect(x - 2.8, y - 5.2, 5.6, 6).fill(0xf08a6a)
  g.rect(x - 3.6, y - 2.8, 7.2, 1.6).fill({ color: 0xf5ecd6, alpha: 0.9 })
}