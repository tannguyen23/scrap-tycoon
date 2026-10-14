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
import { CALM_WIND, type Wind } from '../../weather'
import { drawJunkHeap, drawDrum, drawWeedTuft } from '../alley/sprites'
import { drawZoneFence } from '../fence'
import { Particles, SHADOW } from '../parts'
import { createPopups } from '../popups'
import type { DetailScene, DetailSceneState, Spot } from '../types'
import { createSmith, type SmithActor } from './actors'
import { createForgeLife } from './life'

const CAP = 4
const MAX_SACKS = 9

/** Chồng bao vào + pallet ra, vẽ lại khi tồn kho đổi. */
function drawSackStack(pile: Container, x: number, baseY: number, count: number): void {
  for (const child of pile.removeChildren()) {
    child.destroy()
  }
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 3)
    const col = i % 3
    const sack = new Graphics()
    const sx = x - 12 + col * 9 + (row % 2) * 4
    const sy = baseY - row * 7
    sack.rect(sx, sy - 6, 8, 6).fill(0xc9bfa6)
    sack.rect(sx, sy - 6, 8, 1.2).fill({ color: 0xf5ecd6, alpha: 0.6 })
    sack.rect(sx, sy - 1, 8, 1).fill({ color: 0x000000, alpha: 0.16 })
    pile.addChild(sack)
  }
}

/** Xưởng rèn: nhà hở, lò nấu, đe trên gốc cây, thợ đập búa + tia lửa. */
export function createRecycleDetail(rect: ZoneRect, tiles: TilePainter): DetailScene {
  const root = new Container()
  root.position.set(rect.x, rect.y)
  const width = rect.width
  const height = rect.height

  // Sân bê tông trước xưởng + rác vụn kim loại — KHÔNG vẽ lại sàn (worldGrounds giữ).
  tiles.paintPath(root, { x: 24, y: 92, width: 148, height: 46 }, 'concrete', 404, 'dirt', 16, 22)
  tiles.scatter(root, { x: 0, y: 0, width, height }, 413, 'debris', 26)

  const pile: Spot = { x: 44, y: 100 }
  const hearth: Spot = { x: 150, y: 60 }
  const anvil: Spot = { x: 198, y: 96 }
  const stack: Spot = { x: 116, y: 148 }

  // Dấu vết sử dụng: lối mòn bao → lò → đe, rãnh xe ba gác vào lấy pallet.
  const decals = new Graphics()
  paintWearPath(decals, [pile, hearth, anvil], { seed: 421, strength: 0.9 })
  paintWearPath(decals, [anvil, stack], { seed: 422, strength: 0.75 })
  paintRuts(decals, [{ x: 104, y: 176 }, { x: 112, y: 138 }], { seed: 431, strength: 0.7 })
  paintFootprints(decals, [pile, anvil], { seed: 441, strength: 0.9 })
  paintStain(decals, { x: 148, y: 66 }, { radius: 15, seed: 451, soot: true })
  paintPuddle(decals, 64, 130, 6, 2.6, 461)
  root.addChild(decals)

  const props = new Graphics()
  drawForgeShed(props)
  drawChimney(props)
  drawAnvil(props, anvil.x, anvil.y)
  drawPalletStack(props, stack.x, stack.y + 4)
  drawDrum(props, 78, 56, 0x5c6b78, 0x7d8b98)
  drawDrum(props, 96, 52, 0x7a6a52, 0x93815f)
  drawJunkHeap(props, 34, 44, 1)
  drawJunkHeap(props, 232, 130, 4)
  drawWeedTuft(props, 12, 168)
  drawWeedTuft(props, 252, 88)
  root.addChild(props)

  // Lò nấu: hộc lửa hai frame + quầng sáng nhấp nháy (đèn đêm nằm ở lighting.ts).
  const hearthBase = new Graphics()
  hearthBase.ellipse(hearth.x, hearth.y + 2, 15, 6).fill(SHADOW)
  hearthBase.rect(hearth.x - 13, hearth.y - 12, 26, 14).fill(0x6a6f78)
  hearthBase.rect(hearth.x - 13, hearth.y - 12, 26, 3).fill(0x8b939c)
  hearthBase.rect(hearth.x - 8, hearth.y - 9, 16, 9).fill(0x2b2119)
  root.addChild(hearthBase)

  const flameA = new Graphics()
  flameA.rect(hearth.x - 6, hearth.y - 7, 12, 7).fill(0xf08a3d)
  flameA.rect(hearth.x - 3, hearth.y - 11, 6, 5).fill(0xffc46a)
  const flameB = new Graphics()
  flameB.rect(hearth.x - 7, hearth.y - 6, 14, 6).fill(0xe2762f)
  flameB.rect(hearth.x - 4, hearth.y - 9, 6, 4).fill(0xffd88a)
  const forgeGlow = new Graphics()
    .ellipse(hearth.x, hearth.y - 2, 26, 14)
    .fill({ color: 0xffb45a, alpha: 0.5 })
  root.addChild(forgeGlow, flameA, flameB)

  const fence = new Graphics()
  drawZoneFence(fence, rect, ZONE_LAYOUTS.recycle?.fenceOpenings)
  root.addChild(fence)

  const lamp = new Graphics()
  lamp.rect(170, 66, 2, 10).fill(0x75808d)
  lamp.rect(168, 62, 7, 4).fill(0x93a1b0)
  const lampGlow = new Graphics().ellipse(171.4, 68, 11, 6).fill({ color: 0xffd27f, alpha: 0.9 })
  root.addChild(lamp, lampGlow)

  const sackStack = new Container()
  root.addChild(sackStack)
  let sackLevel = -1

  const fullMark = new Graphics().rect(pile.x - 2, pile.y - 30, 4, 4).fill(0xd9534f)
  fullMark.visible = false
  root.addChild(fullMark)

  const life = createForgeLife({ x: 236, y: 6 })
  root.addChild(life.container)

  const actors = new Container()
  const particles = new Particles()
  const popups = createPopups()
  root.addChild(actors, particles.container, popups.container)

  const smiths: SmithActor[] = []
  let desired = 0
  let stock01 = -1
  let ambient: Wind = CALM_WIND

  const setState = (state: DetailSceneState): void => {
    popups.setLabels(state.labels)
    desired = Math.min(state.workers, CAP)
    while (smiths.length < desired) {
      const smith = createSmith(smiths.length, { pile, hearth, anvil, stack })
      smiths.push(smith)
      actors.addChild(smith.sprite.container)
    }
    for (let i = 0; i < smiths.length; i++) {
      const smith = smiths[i]
      if (smith) smith.sprite.container.visible = i < desired
    }

    stock01 = state.stock01
    const level = stock01 < 0 ? 0 : Math.max(0, Math.min(MAX_SACKS, Math.ceil(stock01 * MAX_SACKS)))
    if (level !== sackLevel) {
      drawSackStack(sackStack, pile.x, pile.y + 6, level)
      sackLevel = level
    }
    fullMark.visible = stock01 >= 0.99
  }

  const update = (dt: number, elapsed: number): void => {
    const frame = Math.floor(elapsed * 8) % 2
    flameA.visible = frame === 0
    flameB.visible = frame === 1
    forgeGlow.alpha = 0.32 + 0.2 * (0.5 + 0.5 * Math.sin(elapsed * 5.5))
    lampGlow.alpha = 0.55 + 0.25 * (0.5 + 0.5 * Math.sin(elapsed * 1.9))
    fullMark.visible = stock01 >= 0.99 && Math.floor(elapsed * 2) % 2 === 0

    for (let i = 0; i < desired; i++) {
      smiths[i]?.update(dt, particles, popups)
    }
    life.update(dt, elapsed, ambient)
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

function drawForgeShed(g: Graphics): void {
  // Nhà hở: cột gỗ đỡ mái tôn, vách sau xây gạch chịu lửa, lòng xưởng tối.
  g.rect(118, 14, 140, 62).fill({ color: 0x000000, alpha: 0.22 })
  g.rect(118, 12, 140, 6).fill(0x7a6045)
  g.rect(118, 12, 140, 1).fill(0x937556)
  for (let x = 124; x < 258; x += 12) {
    g.rect(x, 12, 1, 6).fill({ color: 0x000000, alpha: 0.1 })
  }
  g.rect(252, 18, 6, 58).fill(0x5c4a35)
  g.rect(120, 18, 5, 58).fill(0x5c4a35)
  g.rect(120, 18, 5, 2).fill({ color: 0xffffff, alpha: 0.12 })
  // vách sau gạch chịu lửa
  g.rect(136, 34, 96, 42).fill(0x7a4a3a)
  g.rect(136, 34, 96, 2).fill(0x96604c)
  for (let y = 38; y < 76; y += 6) {
    for (let x = 136 + (y % 12 === 2 ? 6 : 0); x < 232; x += 12) {
      g.rect(x, y, 11, 1).fill({ color: 0x000000, alpha: 0.12 })
    }
  }
}

function drawChimney(g: Graphics): void {
  // Ống khói chính (gạch, cao) + ống phụ (thấp hơn, lệch phải) — xưởng to hai khói.
  g.rect(224, 10, 22, 44).fill(0x8a5a48)
  g.rect(224, 10, 22, 2).fill(0xa8725c)
  for (let y = 14; y < 52; y += 6) {
    g.rect(224, y, 22, 1).fill({ color: 0x000000, alpha: 0.14 })
  }
  g.rect(221, 4, 28, 7).fill(0x6f4636)
  g.rect(221, 4, 28, 2).fill(0x8a5a48)
  g.rect(224, 10, 22, 8).fill({ color: 0x000000, alpha: 0.18 })

  g.rect(248, 22, 12, 32).fill(0x8a5a48)
  g.rect(248, 22, 12, 2).fill(0xa8725c)
  for (let y = 26; y < 54; y += 6) {
    g.rect(248, y, 12, 1).fill({ color: 0x000000, alpha: 0.14 })
  }
  g.rect(246, 17, 16, 6).fill(0x6f4636)
  g.rect(246, 17, 16, 2).fill(0x8a5a48)
  g.rect(248, 22, 12, 6).fill({ color: 0x000000, alpha: 0.18 })
}

function drawAnvil(g: Graphics, x: number, y: number): void {
  // Đe trên gốc cây: gốc sẫm, đe thép sáng mặt trên (nắng trên-trái).
  g.ellipse(x + 1, y + 2, 11, 5).fill(SHADOW)
  g.rect(x - 7, y - 6, 14, 8).fill(0x6b5540)
  g.rect(x - 7, y - 6, 14, 2).fill(0x86694e)
  g.rect(x - 3, y - 8, 6, 3).fill(0x5c4426)
  g.rect(x - 9, y - 13, 18, 5).fill(0x6f767e)
  g.rect(x - 9, y - 13, 18, 1.6).fill(0xdfe6ec)
  g.rect(x - 12, y - 12, 4, 3).fill(0x8b939c)
  g.rect(x - 9, y - 8, 18, 1).fill({ color: 0x000000, alpha: 0.2 })
}

function drawPalletStack(g: Graphics, x: number, y: number): void {
  for (let i = 0; i < 3; i++) {
    const py = y - i * 5
    g.rect(x - 16, py - 3, 32, 3).fill(0x9c7448)
    g.rect(x - 16, py - 3, 32, 1).fill(0xb98d52)
    g.rect(x - 14, py - 6, 4, 3).fill(0x8b939c)
    g.rect(x - 4, py - 6, 4, 3).fill(0x8b939c)
    g.rect(x + 6, py - 6, 4, 3).fill(0x8b939c)
  }
}
