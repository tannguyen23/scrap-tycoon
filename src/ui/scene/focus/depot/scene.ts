import { ZONE_LAYOUTS, type ZoneRect } from '../../zoneLayout'
import { Container, Graphics } from 'pixi.js'
import type { TilePainter } from '../../tiles/painter'
import {
  paintFootprints,
  paintPuddle,
  paintRuts,
  paintStain,
  paintWearPath,
} from '../../tiles/dirtDetail'
import { drawZoneFence } from '../fence'
import { Particles, SHADOW, createSack } from '../parts'
import type { DetailScene, DetailSceneState, Spot } from '../types'
import { createHauler, type HaulerActor } from './actors'
import { createDepotLife } from './life'
import { drawPalletStack } from './sprites'

const CAP = 5
const MAX_PILE_SACKS = 18
const MAX_PALLETS = 8
/** Chồng pallet phôi xe ba gác trút xuống cạnh cổng kho (local; world 284, 586). */
const PALLET_STACK = { x: 204, y: 26 }

/** Detailed depot yard: warehouse, scale, lamp, sack pile + haulers at work. */
export function createDepotDetail(rect: ZoneRect, tiles: TilePainter): DetailScene {
  const root = new Container()
  root.position.set(rect.x, rect.y)
  const width = rect.width
  const height = rect.height

  // KHÔNG vẽ lại sàn ở đây — xem ghi chú ở `focus/alley/scene.ts`: sàn đất của khu
  // đã có trong `worldGrounds`, vẽ lần hai bằng seed khác ở toạ độ local chỉ tạo ra
  // hai trường tông đâm vào nhau giữa sàn.
  // Sân bê tông trước kho: mép dùng tile chuyển tiếp bê tông↔đất nên nó loe ra
  // như sân mòn lẫn đất, không phải một slab với cạnh thẳng.
  tiles.paintPath(root, { x: 4, y: 52, width: 124, height: 36 }, 'concrete', 304, 'dirt', 14, 20)
  tiles.scatter(root, { x: 0, y: 0, width, height }, 313, 'debris', 30)

  const pickup: Spot = { x: 134, y: 60 }
  const dropoff: Spot = { x: 208, y: 72 }

  // Dấu vết sử dụng: tuyến cân → đống bao mòn nhẵn, rãnh xe cút kít từ chỗ để
  // xe tới bàn cân, vết dầu dưới cân và một vũng nước cạnh lối đi.
  const decals = new Graphics()
  paintWearPath(decals, [pickup, dropoff], { seed: 321, strength: 0.9 })
  paintWearPath(decals, [dropoff, { x: dropoff.x + 12, y: dropoff.y + 22 }], { seed: 322, strength: 0.6 })
  paintRuts(decals, [{ x: 60, y: 82 }, pickup], { seed: 331, strength: 0.8 })
  paintFootprints(decals, [pickup, dropoff], { seed: 341, strength: 0.9 })
  paintStain(decals, { x: 134, y: 52 }, { radius: 13, seed: 351 })
  paintPuddle(decals, 100, 40, 5, 2.4, 361)
  root.addChild(decals)

  const props = new Graphics()
  drawWarehouse(props)
  drawScale(props)
  drawCrates(props, 120, 8)
  drawWheelbarrow(props, 60, 78)
  drawNoticeboard(props, 80, 60)
  root.addChild(props)

  // Hàng rào bao sân, cổng mở đúng chỗ lối đi đất + làn nhựa vào kho (cạnh bắc).
  const fence = new Graphics()
  drawZoneFence(fence, rect, ZONE_LAYOUTS.depot?.fenceOpenings)
  root.addChild(fence)

  const lamp = new Graphics()
  lamp.rect(115, 14, 2, 8).fill(0x75808d)
  lamp.rect(113, 10, 7, 4).fill(0x93a1b0)
  const glow = new Graphics().ellipse(116.4, 16, 12, 7).fill({ color: 0xffd27f, alpha: 1 })
  root.addChild(lamp, glow)

  const blink = new Graphics().rect(138, 33, 2, 2).fill(0x9ad46f)
  root.addChild(blink)

  const pile = new Container()
  root.addChild(pile)
  let pileLevel = -1

  // Kho của khu: chồng pallet bên cổng bắc, lớn dần theo tồn `pallet` thật; dấu
  // đỏ nhấp nháy khi bin đầy (chặng ba gác phía trước bị nghẽn).
  const palletStack = new Container()
  palletStack.label = 'warehouse'
  root.addChild(palletStack)
  const palletFullMark = new Graphics().rect(PALLET_STACK.x - 2, PALLET_STACK.y - 34, 4, 4).fill(0xd9534f)
  palletFullMark.visible = false
  root.addChild(palletFullMark)
  let palletLevel = -1
  let stock01 = -1

  const life = createDepotLife({ x: 210, y: 60 })
  root.addChild(life.container)

  const actors = new Container()
  const particles = new Particles()
  root.addChild(actors, particles.container)

  const haulers: HaulerActor[] = []
  let desired = 0

  const setState = (state: DetailSceneState): void => {
    desired = Math.min(state.workers, CAP)
    while (haulers.length < desired) {
      const hauler = createHauler(haulers.length, pickup, dropoff)
      haulers.push(hauler)
      actors.addChild(hauler.sprite.container)
    }
    for (let i = 0; i < haulers.length; i++) {
      const hauler = haulers[i]
      if (hauler) hauler.sprite.container.visible = i < desired
    }

    const level = Math.max(0, Math.min(MAX_PILE_SACKS, Math.round(state.earnedLog10 * 2)))
    if (level !== pileLevel) {
      drawPile(pile, dropoff.x, dropoff.y + 12, level)
      pileLevel = level
    }

    stock01 = state.stock01
    const palletGoal = stock01 < 0 ? 0 : Math.max(0, Math.min(MAX_PALLETS, Math.ceil(stock01 * MAX_PALLETS)))
    if (palletGoal !== palletLevel) {
      drawPalletStack(palletStack, PALLET_STACK.x, PALLET_STACK.y, palletGoal)
      palletLevel = palletGoal
    }
    palletFullMark.visible = stock01 >= 0.99
  }

  const update = (dt: number, elapsed: number): void => {
    glow.alpha = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(elapsed * 1.8))
    blink.visible = Math.floor(elapsed * 1.4) % 2 === 0
    palletFullMark.visible = stock01 >= 0.99 && Math.floor(elapsed * 2) % 2 === 0
    for (let i = 0; i < desired; i++) {
      haulers[i]?.update(dt, particles)
    }
    life.update(dt, elapsed)
    particles.update(dt)
  }

  return { root, setState, update }
}

function drawWarehouse(g: Graphics): void {
  // tường nam nhìn thấy (chiều cao giả) — tôn gợn sóng + cửa kho + biển hiệu
  g.rect(12, 56, 92, 20).fill(0x6b5540)
  g.rect(12, 56, 92, 1).fill({ color: 0x000000, alpha: 0.2 })
  g.rect(12, 75, 92, 1).fill(0x453520)
  for (let x = 18; x < 104; x += 6) {
    g.rect(x, 56, 1, 20).fill({ color: 0x000000, alpha: 0.08 })
  }
  g.rect(48, 60, 20, 16).fill(0x453520)
  g.rect(48, 60, 20, 1).fill(0x5c4426)
  g.rect(67, 60, 1, 16).fill(0x5c4426)
  // mặt hông phía đông
  g.rect(104, 16, 10, 60).fill(0x5c4a35)
  g.rect(104, 16, 1, 60).fill({ color: 0x000000, alpha: 0.2 })
  // cửa sổ sáng đèn trên hông
  g.rect(106, 36, 8, 8).fill(0x3d444e)
  g.rect(107, 37, 6, 6).fill({ color: 0xffd27f, alpha: 0.9 })
  g.rect(107, 37, 6, 2).fill({ color: 0xffe9b8, alpha: 0.6 })
  // mái tôn nhô lên khỏi tường
  g.rect(12, 8, 92, 48).fill(0x7a6045)
  for (let y = 11; y < 56; y += 4) {
    g.rect(12, y, 92, 1).fill({ color: 0x000000, alpha: 0.12 })
  }
  // vảy tôn so le cho mái có hoa văn
  for (let y = 12; y < 56; y += 8) {
    for (let x = 12 + (y % 16 === 12 ? 6 : 0); x < 104; x += 12) {
      g.rect(x, y, 1, 4).fill({ color: 0x000000, alpha: 0.08 })
    }
  }
  g.rect(12, 32, 92, 2).fill(0x937556)
  g.rect(12, 8, 92, 1).fill(0x937556)
  g.rect(103, 8, 1, 48).fill(0x5c4426)
  // biển hiệu trên tường
  g.rect(24, 60, 22, 12).fill(0x96744c)
  g.rect(24, 60, 22, 1).fill({ color: 0x000000, alpha: 0.25 })
  g.rect(27, 63, 10, 2).fill({ color: 0xf5ecd6, alpha: 0.9 })
  g.rect(27, 67, 16, 1.4).fill({ color: 0xf5ecd6, alpha: 0.55 })
}

function drawScale(g: Graphics): void {
  g.rect(120, 54, 28, 12).fill(0x75808d)
  g.rect(120, 53, 28, 3).fill(0xcfe0ef)
  g.rect(120, 66, 28, 2).fill(0x4d5560)
  g.rect(133, 42, 3, 12).fill(0x75808d)
  g.rect(124, 35, 22, 8).fill(0x3d444e)
  g.rect(126, 37, 16, 5).fill(0x24422c)
  g.rect(127, 38, 8, 1.4).fill({ color: 0x9ad46f, alpha: 0.8 })
}

function drawCrates(g: Graphics, x: number, y: number): void {
  g.rect(x, y, 16, 12).fill(0x9c7448)
  g.rect(x + 1, y + 1, 14, 10).stroke({ width: 1, color: 0x5c4426 })
  g.rect(x + 7, y, 1, 12).fill(0x5c4426)
  g.rect(x + 4, y - 8, 12, 8).fill(0xa8814f)
  g.rect(x + 5, y - 7, 10, 6).stroke({ width: 1, color: 0x5c4426 })
}

function drawWheelbarrow(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 1, y + 2, 11, 5.2).fill(SHADOW)
  g.rect(x - 8, y - 6, 14, 10).fill(0x93a1b0)
  g.rect(x - 8, y - 6, 14, 2).fill(0x9aa8b6)
  g.rect(x - 8, y + 2, 14, 2).fill({ color: 0x000000, alpha: 0.15 })
  g.circle(x + 8, y, 3.6).fill(0x1f2126)
  g.rect(x - 11.5, y - 1, 4.5, 1.5).fill(0x74818f)
  g.rect(x - 11.5, y + 3, 4.5, 1.5).fill(0x74818f)
}

function drawNoticeboard(g: Graphics, x: number, y: number): void {
  g.rect(x + 1, y + 2, 18, 14).fill(SHADOW)
  g.rect(x, y, 18, 14).fill(0x96744c)
  g.rect(x + 1, y + 1, 16, 12).fill(0xf5ecd6)
  g.rect(x + 3, y + 3, 6, 5).fill(0xe2d4b2)
  g.rect(x + 10, y + 4, 6, 4).fill(0xfaf2de)
  g.rect(x + 4, y + 9, 10, 1).fill(0xc9bd9c)
}

function drawPile(pile: Container, x: number, baseY: number, count: number): void {
  for (const child of pile.removeChildren()) {
    child.destroy()
  }
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 3)
    const col = i % 3
    const sx = x - 18 + col * 12 + (row % 2) * 3
    const sy = baseY - row * 8
    const sack = createSack(1)
    sack.position.set(sx, sy)
    pile.addChild(sack)
  }
}