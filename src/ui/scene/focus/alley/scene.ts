import { ZONE_LAYOUTS, type ZoneRect } from '../../zoneLayout'
import { Container, Graphics } from 'pixi.js'
import type { TilePainter } from '../../tiles/painter'
import {
  paintDragMarks,
  paintFootprints,
  paintPuddle,
  paintRuts,
  paintStain,
  paintWearPath,
} from '../../tiles/dirtDetail'
import { drawZoneFence } from '../fence'
import { Particles } from '../parts'
import { createPopups } from '../popups'
import type { DetailScene, DetailSceneState, Spot } from '../types'
import { CALM_WIND, type Wind } from '../../weather'
import { createPicker, createPorter, type PickerActor, type PorterActor } from './actors'
import { createAlleyLife } from './life'
import {
  drawBagPile,
  drawBottle,
  drawBrokenTv,
  drawCrate,
  drawDrum,
  drawDumpster,
  drawFlatTire,
  drawFridge,
  drawGreenBin,
  drawJunkHeap,
  drawLeaningSheet,
  drawLeaningTire,
  drawPallet,
  drawTippedBin,
  drawTippedDrum,
  drawTireStack,
  drawTrashBag,
  drawWasher,
  drawWeedTuft,
} from './sprites'

const PICKER_CAP = 8
const PORTER_CAP = 4

/**
 * Bãi rác của khu ve chai: bảy đống phế liệu so le cỡ, thùng rác công nghiệp, hai
 * thùng nhựa xanh (một nắp mở), một thùng đổ nghiêng, bao vứt lẻ, chai lọ lăn quanh,
 * xác tủ lạnh/máy giặt, lốp, pallet và hai món đổ nghiêng. Sàn đất do `worldGrounds`
 * vẽ (một nguồn cho cả map lẫn studio) — ở đây chỉ thêm lớp của khu.
 *
 * Vòng logistics nhìn thấy được: pickers toả từ các đống chọt lon rồi mang bao GOM
 * VỀ MỘT MỐI tại điểm đổ (đống bao lớn dần theo tồn `scrap`); porters bốc bao từ đống
 * đó vác ra cổng đông — đúng lối mòn sang xưởng tái chế. Bãi trông thật vì các đống
 * LỆCH nhau: cỡ lấy từ bảng trong `sprites.ts`, vị trí thì so le chứ không chia đều.
 */
export function createAlleyDetail(rect: ZoneRect, tiles: TilePainter): DetailScene {
  const root = new Container()
  root.position.set(rect.x, rect.y)
  const width = rect.width
  const height = rect.height

  // Đống gạch vụn giữa bãi: blob sỏi NẰM TRONG nền đất nên dùng cặp sỏi↔đất.
  tiles.paintBlob(root, { x: 20, y: 150, width: 130, height: 84 }, 'gravel', 102, 14, 'dirt')
  tiles.scatter(root, { x: 0, y: 0, width, height }, 111, 'debris', 30)

  const piles: Spot[] = [
    { x: 34, y: 56 },
    { x: 118, y: 46 },
    { x: 196, y: 40 },
    { x: 300, y: 92 },
    { x: 36, y: 168 },
    { x: 138, y: 156 },
    { x: 280, y: 214 },
  ]
  const dropoff: Spot = { x: 192, y: 246 }
  /** Lỗ cổng đông mở đúng lối mòn sang xưởng tái chế (local y 52..100) — porter vác bao ra đây. */
  const haulOut: Spot = { x: 340, y: 76 }

  // Chỗ rác tươi: thùng nhựa xanh cạnh thùng công nghiệp, một thùng đổ nghiêng trên
  // mảng sỏi, bao vứt lẻ rải quanh bãi — ruồi tụ quanh đây chứ không tụ ở đống sắt.
  const binA: Spot = { x: 238, y: 96 }
  const binB: Spot = { x: 258, y: 100 }
  const tippedBin: Spot = { x: 140, y: 210 }
  const looseBags: Spot[] = [
    { x: 208, y: 168 },
    { x: 96, y: 180 },
    { x: 272, y: 244 },
  ]

  // Dấu vết sử dụng: lối mòn toả từ điểm đổ ra từng đống, vết chân trên hai tuyến
  // chính, vệt kéo đồ từ thùng rác ra đống gần nhất, rãnh bánh xe trên làn ra và
  // vũng dầu dưới thùng phuy.
  const decals = new Graphics()
  for (const pile of piles) {
    paintWearPath(decals, [dropoff, pile], { seed: 121 + pile.x, strength: 0.6 })
  }
  paintWearPath(decals, [piles[0] ?? dropoff, piles[6] ?? dropoff], { seed: 131, strength: 0.8 })
  paintFootprints(decals, [dropoff, piles[0] ?? dropoff], { seed: 141, strength: 0.9 })
  paintFootprints(decals, [dropoff, piles[4] ?? dropoff], { seed: 142, strength: 0.8 })
  // Đường vác bao: porter đi từ đống gom ra cổng đông suốt ngày.
  paintWearPath(decals, [dropoff, haulOut], { seed: 133, strength: 0.5 })
  paintDragMarks(decals, [{ x: 258, y: 62 }, piles[2] ?? dropoff], { seed: 151, strength: 0.6 })
  paintRuts(decals, [{ x: 196, y: 238 }, { x: 188, y: 116 }], { seed: 152, strength: 0.7 })
  paintStain(decals, { x: 166, y: 82 }, { radius: 14, soot: true, seed: 161 })
  paintStain(decals, { x: 286, y: 56 }, { radius: 12, soot: true, seed: 162 })
  paintPuddle(decals, 62, 240, 6, 2.6, 171)
  paintPuddle(decals, 236, 240, 5, 2.2, 172)
  root.addChild(decals)

  const props = new Graphics()
  piles.forEach((pile, index) => drawJunkHeap(props, pile.x, pile.y, index))
  drawDumpster(props, 250, 44)
  drawCrate(props, 112, 88)
  drawPallet(props, 110, 232)
  drawFridge(props, 306, 158)
  drawWasher(props, 22, 244)
  drawTireStack(props, 86, 108, 3)
  drawFlatTire(props, 68, 114, 6.4)
  drawLeaningTire(props, 240, 47, 6.2)
  drawLeaningSheet(props, 56, 40)
  drawDrum(props, 166, 74, 0x5d8a74, 0x7aa884)
  drawDrum(props, 322, 176, 0x5a6a8a, 0x78899f)
  drawDrum(props, 24, 118, 0x9c5a48, 0xba7059)
  drawTippedDrum(props, 316, 244, 0x9c5a48, 0xba7059)
  drawBrokenTv(props, 66, 216)
  drawGreenBin(props, binA.x, binA.y)
  drawGreenBin(props, binB.x, binB.y, true)
  drawTippedBin(props, tippedBin.x, tippedBin.y)
  looseBags.forEach((bag, index) => drawTrashBag(props, bag.x, bag.y, 4.5 + (index % 2)))
  for (const bottle of [
    [230, 112, 0, true],
    [264, 110, 1, false],
    [128, 216, 0, false],
    [153, 206, 2, true],
    [136, 198, 1, true],
    [54, 204, 0, true],
    [250, 182, 2, true],
  ] as const) {
    drawBottle(props, bottle[0], bottle[1], bottle[2], bottle[3])
  }
  for (const tuft of [
    [18, 26],
    [318, 30],
    [16, 130],
    [240, 122],
    [100, 20],
    [326, 214],
    [204, 262],
  ] as const) {
    drawWeedTuft(props, tuft[0], tuft[1])
  }
  root.addChild(props)

  // Hàng rào bao bãi, cổng mở đúng chỗ làn đất bãi → đường cắt qua cạnh nam.
  const fence = new Graphics()
  drawZoneFence(fence, rect, ZONE_LAYOUTS.alley?.fenceOpenings)
  root.addChild(fence)

  // Đống gom MỘT MỐI: bao thợ nhặt mang về chất tại điểm đổ, lớn dần theo tồn `scrap`
  // (đầy = thợ nhặt đứng chờ, porter hết bao để vác). Vẽ dưới lớp actors.
  const scrapPile = new Graphics()
  root.addChild(scrapPile)

  const life = createAlleyLife(piles, [
    binA,
    binB,
    tippedBin,
    ...looseBags,
    { x: dropoff.x, y: dropoff.y - 2 },
  ])
  root.addChild(life.container)

  const actors = new Container()
  const particles = new Particles()
  const popups = createPopups()
  root.addChild(actors, particles.container, popups.container)

  const pickers: PickerActor[] = []
  const porters: PorterActor[] = []
  let desiredPickers = 0
  let desiredPorters = 0
  let ambient: Wind = CALM_WIND
  let stock01 = -1
  let pileLevel = -1

  const pileFullMark = new Graphics().rect(dropoff.x - 2, dropoff.y - 32, 4, 4).fill(0xd9534f)
  pileFullMark.visible = false
  root.addChild(pileFullMark)

  const setState = (state: DetailSceneState): void => {
    popups.setLabels(state.labels)
    desiredPickers = Math.min(state.actions.pick ?? 0, PICKER_CAP)
    while (pickers.length < desiredPickers) {
      const picker = createPicker(pickers.length, piles, dropoff)
      pickers.push(picker)
      actors.addChild(picker.sprite.container)
    }
    for (let i = 0; i < pickers.length; i++) {
      const picker = pickers[i]
      if (picker) picker.sprite.container.visible = i < desiredPickers
    }

    desiredPorters = Math.min(state.actions.haul ?? 0, PORTER_CAP)
    while (porters.length < desiredPorters) {
      const porter = createPorter(porters.length, dropoff, haulOut)
      porters.push(porter)
      actors.addChild(porter.sprite.container)
    }
    for (let i = 0; i < porters.length; i++) {
      const porter = porters[i]
      if (porter) porter.sprite.container.visible = i < desiredPorters
    }

    stock01 = state.stock01
    const level = stock01 < 0 ? 0 : Math.max(0, Math.min(8, Math.ceil(stock01 * 8)))
    if (level !== pileLevel) {
      scrapPile.clear()
      drawBagPile(scrapPile, dropoff.x, dropoff.y - 2, level)
      pileLevel = level
    }
  }

  const update = (dt: number, elapsed: number): void => {
    pileFullMark.visible = stock01 >= 0.99 && Math.floor(elapsed * 2) % 2 === 0
    for (let i = 0; i < desiredPickers; i++) {
      pickers[i]?.update(dt, particles, popups)
    }
    for (let i = 0; i < desiredPorters; i++) {
      porters[i]?.update(dt, particles)
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
