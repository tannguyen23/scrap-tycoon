import type { ZoneRect } from '../../zoneLayout'
import { Container, Graphics } from 'pixi.js'
import type { TilePainter } from '../../tiles/painter'
import { Particles, SHADOW } from '../parts'
import type { DetailScene, DetailSceneState } from '../types'
import { createRouteVehicle, type VehicleActor } from './actors'

const CAP = 5

/** Detailed cart route: sidewalks, road wear and carts looping both lanes. */
export function createRouteDetail(rect: ZoneRect, tiles: TilePainter): DetailScene {
  const root = new Container()
  root.position.set(rect.x, rect.y)
  const width = rect.width
  const height = rect.height

  tiles.paintMasked(root, { x: 0, y: 0, width, height }, 'asphalt', 202)

  // KHÔNG vẽ vệt đất lên mặt đường: tile chuyển tiếp luôn kéo theo vành 1 ô theo
  // tông `outside`, nên mọi mảng đất nằm trên nhựa đều hiện viền sáng quanh nó —
  // trông như vết bẩn có outline chứ không ra lối mòn. Mép đường giữ thẳng (đường
  // trong pixel art vốn thẳng), còn "dấu vết xe qua lại" nằm ở làn đất phía ngoài.

  const props = new Graphics()
  // vỉa hè hai bên
  props.rect(0, 0, width, 6).fill(0x6f7681)
  props.rect(0, 6, width, 1).fill({ color: 0x4a5058, alpha: 0.9 })
  props.rect(0, height - 6, width, 6).fill(0x6f7681)
  props.rect(0, height - 7, width, 1).fill({ color: 0x4a5058, alpha: 0.9 })
  // vạch tim đường
  for (let x = 12; x < width; x += 28) {
    props.rect(x, height / 2 - 0.5, 14, 1).fill(0x848c9b)
  }
  // nứt đường, sỏi, nắp cống
  props.rect(80, 16, 18, 1).fill({ color: 0x3f4650, alpha: 0.5 })
  props.rect(300, 42, 14, 1).fill({ color: 0x3f4650, alpha: 0.5 })
  props.rect(420, 20, 2, 2).fill(0x6f7681)
  props.rect(240, 50, 2, 1).fill(0x6f7681)
  props.circle(360, 44, 6).fill({ color: 0x565c66, alpha: 0.9 })
  props.circle(360, 44, 6).stroke({ width: 1, color: 0x3f4650 })
  props.rect(356, 43, 8, 1).fill({ color: 0x6f7681, alpha: 0.9 })
  // trụ cứu hỏa
  props.circle(120, 13, 4.4).fill(0xd94b3a)
  props.rect(117, 9, 6, 2).fill(0xb83a2c)
  props.circle(120, 13, 4.4).stroke({ width: 0.5, color: 0x8f2a1f })
  // biển bến đỗ
  props.rect(536, 8, 1.2, 10).fill(0x9aa8b6)
  props.rect(531, 6, 12, 6).fill(0x6f7681)
  props.rect(533, 8, 8, 2).fill(0xcfe0ef)
  // ổ gà + túi rác bên lề
  props.ellipse(192, 36, 7, 4.4).fill(0x3a4048)
  props.ellipse(192, 35, 4.4, 2.4).fill({ color: 0x4a5058, alpha: 0.9 })
  drawTrashBags(props, 456, 14)
  // cột đèn đường (quầng sáng do tầng lighting vẽ)
  props.rect(929, 6, 2, 22).fill(0x59616d)
  props.rect(928, 5, 1, 23).fill({ color: 0x000000, alpha: 0.18 })
  props.rect(925, 2, 10, 3).fill(0x6f7681)
  props.rect(927, 5, 6, 2).fill({ color: 0xffe9b8, alpha: 0.9 })
  props.rect(239, 6, 2, 22).fill(0x59616d)
  props.rect(238, 5, 1, 23).fill({ color: 0x000000, alpha: 0.18 })
  props.rect(235, 2, 10, 3).fill(0x6f7681)
  props.rect(237, 5, 6, 2).fill({ color: 0xffe9b8, alpha: 0.9 })
  root.addChild(props)

  const actors = new Container()
  const particles = new Particles()
  root.addChild(actors, particles.container)

  const vehicles: VehicleActor[] = []
  let desired = 0
  let tier = 0

  const ensureVehicles = (): void => {
    while (vehicles.length < desired) {
      const vehicle = createRouteVehicle(vehicles.length, width, height / 2, tier)
      vehicles.push(vehicle)
      actors.addChild(vehicle.sprite.container)
    }
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i]
      if (vehicle) vehicle.sprite.container.visible = i < desired
    }
  }

  const setState = (state: DetailSceneState): void => {
    desired = Math.min(state.workers, CAP)
    if (state.tier !== tier) {
      // Đổi bậc xe là đổi hẳn art của cả đội (ba gác → bán tải → xe tải):
      // dựng lại từ đầu theo tier mới thay vì cố vá sprite cũ.
      tier = state.tier
      for (const vehicle of vehicles) vehicle.sprite.container.destroy({ children: true })
      vehicles.length = 0
    }
    ensureVehicles()
  }

  const update = (dt: number): void => {
    for (let i = 0; i < desired; i++) {
      vehicles[i]?.update(dt, particles)
    }
    particles.update(dt)
  }

  return { root, setState, update }
}

function drawTrashBags(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 2, y + 2, 9, 4.8).fill(SHADOW)
  g.circle(x, y, 4).fill(0x4a5460)
  g.circle(x + 4.4, y + 1.6, 3.4).fill(0x3f4855)
  g.circle(x + 2.2, y - 3.4, 3).fill(0x596470)
  g.rect(x - 1, y - 3, 2, 2).fill({ color: 0x3a4048, alpha: 0.8 })
}