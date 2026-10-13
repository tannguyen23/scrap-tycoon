import type { ZoneRect } from '../../zoneLayout'
import { Container, Graphics } from 'pixi.js'
import type { TilePainter } from '../../tiles/painter'
import {
  paintDragMarks,
  paintFootprints,
  paintPuddle,
  paintStain,
  paintWearPath,
} from '../../tiles/dirtDetail'
import { Particles, SHADOW } from '../parts'
import type { DetailScene, DetailSceneState, Spot } from '../types'
import { createPicker, type PickerActor } from './actors'
import { createAlleyLife } from './life'

const CAP = 8

/** Detailed picking alley: scrap piles, crate, barrel + walk-pick-carry loop. */
export function createAlleyDetail(rect: ZoneRect, tiles: TilePainter): DetailScene {
  const root = new Container()
  root.position.set(rect.x, rect.y)
  const width = rect.width
  const height = rect.height

  tiles.paintBlob(root, { x: 0, y: 0, width, height }, 'dirt', 101, 16, 'dirt')
  tiles.scatter(root, { x: 0, y: 0, width, height }, 111, 'debris', 30)

  const piles: Spot[] = [
    { x: 36, y: 34 },
    { x: 100, y: 24 },
    { x: 168, y: 44 },
    { x: 156, y: 92 },
    { x: 60, y: 96 },
  ]
  const dropoff: Spot = { x: 112, y: 112 }

  // Dấu vết sử dụng: lối mòn toả từ điểm đổ ra từng đống, vết chân trên hai
  // tuyến chính, vệt kéo bao, than/tro quanh thùng phuy và vũng nước chỗ trũng.
  const decals = new Graphics()
  for (const pile of piles) {
    paintWearPath(decals, [dropoff, pile], { seed: 121 + pile.x, strength: 0.6 })
  }
  paintWearPath(decals, [piles[0] ?? dropoff, piles[4] ?? dropoff], { seed: 131, strength: 0.8 })
  paintFootprints(decals, [dropoff, piles[0] ?? dropoff], { seed: 141, strength: 0.9 })
  paintFootprints(decals, [dropoff, piles[3] ?? dropoff], { seed: 142, strength: 0.8 })
  paintDragMarks(decals, [dropoff, { x: dropoff.x + 26, y: dropoff.y + 5 }], { seed: 151, strength: 0.6 })
  paintStain(decals, { x: 200, y: 24 }, { radius: 16, soot: true, seed: 161 })
  paintPuddle(decals, 52, 70, 5, 2.5, 171)
  paintPuddle(decals, 176, 92, 4, 2, 172)
  root.addChild(decals)

  const props = new Graphics()
  for (const pile of piles) drawPile(props, pile.x, pile.y)
  drawCrate(props, 124, 60)
  drawBarrel(props, 204, 66)
  drawBrokenTv(props, 32, 88)
  drawTires(props, 136, 104)
  for (const tuft of [
    [20, 16],
    [208, 24],
    [16, 108],
    [196, 116],
    [84, 12],
  ] as const) {
    props.rect(tuft[0], tuft[1], 1, 4).fill({ color: 0x74a05f, alpha: 0.85 })
    props.rect(tuft[0] + 2, tuft[1] + 1, 1, 3).fill({ color: 0x74a05f, alpha: 0.6 })
  }
  root.addChild(props)

  const life = createAlleyLife(piles)
  root.addChild(life.container)

  const actors = new Container()
  const particles = new Particles()
  root.addChild(actors, particles.container)

  const pickers: PickerActor[] = []
  let desired = 0

  const setState = (state: DetailSceneState): void => {
    desired = Math.min(state.workers, CAP)
    while (pickers.length < desired) {
      const picker = createPicker(pickers.length, piles, dropoff)
      pickers.push(picker)
      actors.addChild(picker.sprite.container)
    }
    for (let i = 0; i < pickers.length; i++) {
      const picker = pickers[i]
      if (picker) picker.sprite.container.visible = i < desired
    }
  }

  const update = (dt: number, elapsed: number): void => {
    for (let i = 0; i < desired; i++) {
      pickers[i]?.update(dt, particles)
    }
    life.update(dt, elapsed)
    particles.update(dt)
  }

  return { root, setState, update }
}

function drawPile(g: Graphics, x: number, y: number): void {
  g.rect(x - 12, y - 4, 10, 4).fill(0x8a97a6)
  g.rect(x - 4, y - 8, 8, 8).fill(0x74818f)
  g.rect(x + 4, y - 2, 8, 6).fill(0x93a1b0)
  g.rect(x - 8, y - 10, 4, 3).fill(0x9aa8b6)
  g.rect(x + 2, y - 11, 6, 2).fill({ color: 0xb08a55, alpha: 0.9 })
  g.rect(x + 10, y - 6, 2, 1).fill({ color: 0xaab3c0, alpha: 0.9 })
  g.circle(x + 12, y - 10, 6).stroke({ width: 2, color: 0x2b2f3d })
  g.circle(x + 12, y - 10, 2).fill(0x4d5560)
}

function drawCrate(g: Graphics, x: number, y: number): void {
  g.rect(x, y, 18, 14).fill(0x9c7448)
  g.rect(x, y, 18, 2).fill(0xa8814f)
  g.rect(x + 1, y + 1, 16, 12).stroke({ width: 1, color: 0x5c4426 })
  g.rect(x + 8, y, 1, 14).fill(0x5c4426)
  g.rect(x + 4, y - 6, 12, 6).fill(0xa8814f)
  g.rect(x + 4, y - 6, 12, 6).stroke({ width: 1, color: 0x5c4426 })
  g.rect(x, y + 12, 18, 2).fill({ color: 0x000000, alpha: 0.2 })
}

function drawBarrel(g: Graphics, x: number, y: number): void {
  g.ellipse(x, y, 7, 5).fill(0x5d8a74)
  g.ellipse(x, y, 4, 2.4).fill(0x74a05f)
  g.ellipse(x, y, 2, 1.2).fill(0x4f7a5a)
  g.rect(x - 7, y - 1, 14, 1).fill({ color: 0x000000, alpha: 0.18 })
}

function drawBrokenTv(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 1, y + 6, 9, 4).fill(SHADOW)
  g.rect(x - 7, y - 6, 14, 12).fill(0x3d444e)
  g.rect(x - 7, y - 6, 14, 2).fill(0x4d5560)
  g.rect(x - 4, y - 3, 8, 6).fill({ color: 0x6d7a88, alpha: 0.9 })
  g.rect(x - 2, y - 1, 4, 2).fill({ color: 0xcfe0ef, alpha: 0.6 })
  g.rect(x + 2, y - 10, 1, 4).fill(0x9aa8b6)
  g.rect(x + 6, y - 12, 1, 6).fill(0x9aa8b6)
  g.rect(x - 7, y + 4, 14, 2).fill({ color: 0x000000, alpha: 0.22 })
  g.rect(x - 5, y - 5, 1, 3).fill({ color: 0x1f2126, alpha: 0.5 })
  g.rect(x + 3, y + 1, 2, 1).fill({ color: 0x1f2126, alpha: 0.4 })
}

function drawTires(g: Graphics, x: number, y: number): void {
  g.ellipse(x + 1, y + 2, 8, 6.4).fill(SHADOW)
  g.circle(x, y, 7).fill(0x2b2f3d)
  g.circle(x, y, 4.4).fill(0x1a1c22)
  g.circle(x, y, 2.8).fill(0x2b2f3d)
  g.circle(x, y, 1.2).fill(0x111318)
}