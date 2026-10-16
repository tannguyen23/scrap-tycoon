import { ZONE_LAYOUTS, type ZoneRect } from '@ground/packs/scrapYard/worldLayout'
import { Container, Graphics } from 'pixi.js'
import type { TilePainter } from '@ground/core/painter'
import {
  paintDragMarks,
  paintFootprints,
  paintPuddle,
  paintRuts,
  paintStain,
  paintWearPatch,
  paintWearPath,
} from '@ground/packs/scrapYard/decals'
import { drawZoneRing } from '../fence'
import { Particles, depthArt, sortByDepth } from '../parts'
import { createPickTag } from '../pickTag'
import { createPopups } from '../popups'
import { drawProp, type ZoneProp } from '../props'
import type { DetailScene, DetailSceneState, Spot } from '@scene/core/types'
import { CALM_WIND, type SceneWind } from '@scenery/core/ambience'
import { createPicker, createPorter, type PickerActor, type PorterActor } from './actors'
import { createAlleyLife } from './life'
import {
  drawBagPile,
  drawBottle,
  drawFlatTire,
  drawLooseScrap,
  drawPallet,
  drawTippedBin,
  drawTippedDrum,
  drawTrashBag,
  drawWeedTuft,
} from './sprites'

const PICKER_CAP = 8
const PORTER_CAP = 4

/**
 * Đống phế liệu thợ chọt (toạ độ LOCAL của bãi làm việc): rải so le khắp thửa, không
 * đống nào chạm vành và không đống nào đè lên nhau — bãi trông bừa mà vẫn đi lại được.
 */
const ALLEY_PILES: Spot[] = [
  { x: 60, y: 56 },
  { x: 170, y: 52 },
  { x: 280, y: 60 },
  { x: 355, y: 70 },
  { x: 60, y: 190 },
  { x: 164, y: 200 },
  { x: 280, y: 150 },
  { x: 355, y: 170 },
  { x: 120, y: 255 },
]

/** Điểm đổ bao — nơi picker dồn hàng về, cũng là chỗ porter bốc bao lên. */
export const ALLEY_DROPOFF: Spot = { x: 256, y: 262 }
/** Lỗ cổng đông (local y 68..116) — porter vác bao ra đây, courier bắt hàng ở đây. */
export const ALLEY_HAUL_OUT: Spot = { x: 404, y: 72 }

// Chỗ rác tươi: thùng nhựa xanh cạnh thùng công nghiệp, một thùng đổ nghiêng, bao vứt lẻ
// rải quanh bãi — ruồi tụ quanh đây chứ không tụ ở đống sắt.
const BIN_A: Spot = { x: 302, y: 112 }
const BIN_B: Spot = { x: 322, y: 116 }
const TIPPED_BIN: Spot = { x: 340, y: 128 }
const LOOSE_BAGS: readonly Spot[] = [
  { x: 236, y: 158 },
  { x: 110, y: 205 },
  { x: 296, y: 260 },
]

/**
 * Vật ĐỨNG của bãi làm việc — nguồn DUY NHẤT cho cả art lẫn đế va chạm (`walkable` dựng
 * hộp chặn từ chính danh sách này). Vật NẰM (pallet, lốp nằm, thùng đổ nghiêng, bao vứt
 * lẻ, chai, cỏ) không khai: bước qua được.
 *
 * Đống bao gom (`ALLEY_DROPOFF`) và mọi chồng kho khác CỐ Ý không khai đế: chúng lớn lên
 * theo tồn kho nên lúc rỗng chẳng có gì ở đó — một hộp chặn tĩnh là "chiếm chỗ" vô hình
 * (người chơi đâm vào khoảng không). Xem luật trong `AGENTS.md`.
 *
 * Món cuối là `fixed`: thùng phuy cháy do `life.ts` vẽ.
 */
export const ALLEY_PROPS: readonly ZoneProp[] = [
  ...ALLEY_PILES.map((pile, index): ZoneProp => ({ kind: 'heap', x: pile.x, y: pile.y, variant: index })),
  { kind: 'dumpster', x: 110, y: 90 },
  { kind: 'crate', x: 176, y: 104 },
  { kind: 'fridge', x: 368, y: 136 },
  { kind: 'washer', x: 70, y: 240 },
  { kind: 'tireStack', x: 140, y: 140, variant: 3 },
  { kind: 'leaningTire', x: 200, y: 90 },
  { kind: 'leaningSheet', x: 250, y: 110 },
  { kind: 'drum', x: 230, y: 90, variant: 0 },
  { kind: 'drum', x: 28, y: 84, variant: 1 },
  { kind: 'drum', x: 106, y: 162, variant: 2 },
  { kind: 'brokenTv', x: 58, y: 254 },
  { kind: 'greenBin', x: BIN_A.x, y: BIN_A.y },
  { kind: 'greenBin', x: BIN_B.x, y: BIN_B.y, variant: 1 },
  { kind: 'fixed', x: 214, y: 134, half: 9, height: 10 },
]

/**
 * Mọi điểm thợ dừng lại làm việc (toạ độ LOCAL). Xuất ra để test khoá luật quan trọng
 * nhất của bãi: picker/porter **đi thẳng** giữa hai waypoint (không pathfind), nên
 * không waypoint nào được nằm trong chuồng và đoạn thẳng của mỗi chặng không được cắt
 * rào chuồng — cắt là thợ xuyên rào.
 */
export const ALLEY_WORK_SPOTS: readonly Spot[] = [...ALLEY_PILES, ALLEY_DROPOFF, ALLEY_HAUL_OUT]

/**
 * Các CHẶNG thợ thực sự đi: picker chọt ở một đống rồi vác bao về điểm đổ (lúc vào ca
 * còn đi từ đống mình đứng sang đống nhận được), porter bốc bao ở điểm đổ vác ra cổng
 * đông. Đây mới là tập tuyến phải kiểm — không phải mọi cặp điểm làm việc.
 */
export const ALLEY_WORK_RUNS: readonly (readonly [Spot, Spot])[] = [
  ...ALLEY_PILES.map((pile): [Spot, Spot] => [pile, ALLEY_DROPOFF]),
  ...ALLEY_PILES.flatMap((from): [Spot, Spot][] =>
    ALLEY_PILES.filter((to) => to !== from).map((to): [Spot, Spot] => [from, to]),
  ),
  [ALLEY_DROPOFF, ALLEY_HAUL_OUT],
]

/**
 * Lối đi nối ba thửa nằm ở TẦNG BẢN ĐỒ (`SCRAP_MAP.trails` trong `worldGrounds`) chứ
 * không ở đây: đường nối các khu là địa lý của cả bãi, không thuộc riêng thửa nào.
 */

/**
 * Bãi rác của khu ve chai — thửa ĐÔNG-NAM của bãi, chỗ thợ làm việc: chín đống phế
 * liệu so le, thùng rác công nghiệp, hai thùng nhựa xanh (một nắp mở), một thùng đổ
 * nghiêng, bao vứt lẻ, chai lọ lăn quanh, xác tủ lạnh/máy giặt, lốp, pallet và hai món
 * đổ nghiêng. Sàn đất do `worldGrounds` vẽ (một nguồn cho cả map lẫn studio) — ở đây
 * chỉ thêm lớp của khu.
 *
 * Vòng logistics nhìn thấy được: pickers toả từ các đống chọt lon rồi mang bao GOM
 * VỀ MỘT MỐI tại điểm đổ (đống bao lớn dần theo tồn `scrap`); porters bốc bao từ đống
 * đó vác ra cổng đông — đúng lối mòn sang xưởng tái chế. Bãi trông thật vì các đống
 * LỆCH nhau: cỡ lấy từ bảng trong `sprites.ts`, vị trí thì so le chứ không chia đều.
 *
 * Đống phải nằm TRONG thửa, không đống nào chạm vành: picker/porter đi thẳng giữa hai
 * waypoint (không pathfind) nên vành cắt ngang tuyến là thợ xuyên rào.
 */
export function createAlleyDetail(rect: ZoneRect, tiles: TilePainter): DetailScene {
  const root = new Container()
  root.position.set(rect.x, rect.y)
  const width = rect.width
  const height = rect.height

  // Đống gạch vụn giữa sàn: blob sỏi NẰM TRONG nền đất nên dùng cặp sỏi↔đất.
  tiles.paintBlob(root, { x: 28, y: 174, width: 66, height: 42 }, 'gravel', 102, 14, 'dirt')
  // Sân chừa trống cho món rời (`ZONE_LAYOUTS.alley.looseBay`) — prop, bao vứt lẻ và
  // CẢ lớp rải vụn nền phải tránh: mẩu sắt 4px chỉ đọc ra khi nó là thứ duy nhất ở đó.
  const looseBay = ZONE_LAYOUTS.alley?.looseBay
  // Mảnh vụn rải theo ô lưới nên mật độ tự giữ nguyên theo diện tích.
  tiles.scatter(root, { x: 0, y: 0, width, height }, 111, 'debris', 30, looseBay ? [looseBay] : [])

  const piles = ALLEY_PILES
  const dropoff = ALLEY_DROPOFF
  const haulOut = ALLEY_HAUL_OUT

  // Dấu vết sử dụng: nền bị giẫm ở điểm đổ, vệt hằn trên những chặng đi lại nhiều, vệt
  // kéo đồ, rãnh bánh và vũng dầu dưới thùng phuy.
  const decals = new Graphics()
  // Điểm đổ là chỗ MỌI tuyến hội tụ ⇒ nền ở đó mòn thành MẢNG. Vẽ mỗi chặng một vệt toả
  // ra từ đây là ra "mấy đường như để nhân vật đi theo", không ra bãi thật.
  paintWearPatch(decals, dropoff, { radius: 26, seed: 120, strength: 0.85 })
  // Chỉ những đống GẦN nhất mới hằn thành vệt: chuyến ngắn thì đi lại nhiều lần. Xa hơn
  // thì nền còn nguyên (xe đẩy mới đi tới đó, và không phải ngày nào cũng đi).
  const busiest = [...piles].sort(
    (a, b) => Math.hypot(a.x - dropoff.x, a.y - dropoff.y) - Math.hypot(b.x - dropoff.x, b.y - dropoff.y),
  )
  busiest.slice(0, 2).forEach((pile, index) => {
    paintWearPath(decals, [dropoff, pile], { seed: 121 + index, strength: 0.5 - index * 0.12 })
  })
  paintFootprints(decals, [dropoff, busiest[0] ?? dropoff], { seed: 141, strength: 0.8 })
  // Đường vác bao: porter đi từ đống gom ra cổng đông suốt ngày.
  paintWearPath(decals, [dropoff, haulOut], { seed: 133, strength: 0.5 })
  paintDragMarks(decals, [{ x: 250, y: 120 }, piles[6] ?? dropoff], { seed: 151, strength: 0.6 })
  paintRuts(decals, [{ x: 240, y: 250 }, { x: 228, y: 190 }], { seed: 152, strength: 0.6 })
  paintStain(decals, { x: 230, y: 92 }, { radius: 14, soot: true, seed: 161 })
  paintStain(decals, { x: 350, y: 128 }, { radius: 12, soot: true, seed: 162 })
  paintPuddle(decals, 60, 272, 6, 2.6, 171)
  paintPuddle(decals, 300, 268, 5, 2.2, 172)
  // Lối vào bãi: mòn dần từ cổng nam vào sàn.
  paintWearPath(decals, [{ x: 258, y: 282 }, { x: 262, y: 240 }], { seed: 184, strength: 0.5 })
  root.addChild(decals)

  // Lớp depth của khu: actor + prop cao cùng xếp theo y — nhân vật đi RA SAU đống
  // phế liệu, thùng rác, tủ lạnh, lốp... thay vì luôn bị vẽ đè lên.
  const actors = new Container()
  actors.label = 'actors'

  // Thứ nằm PHẲNG trên nền (bao vứt lẻ, chai lọ lăn, cụm cỏ) vẫn ở lớp tĩnh.
  const props = new Graphics()
  LOOSE_BAGS.forEach((bag, index) => drawTrashBag(props, bag.x, bag.y, 4.5 + (index % 2)))
  for (const bottle of [
    [294, 128, 0, true],
    [328, 126, 1, false],
    [150, 262, 0, false],
    [26, 120, 2, true],
    [206, 258, 1, true],
    [96, 244, 0, true],
    [314, 198, 2, true],
    [60, 120, 1, false],
    [150, 120, 2, true],
    [330, 160, 0, false],
    [90, 70, 0, false],
    [200, 60, 1, true],
    [40, 230, 1, true],
  ] as const) {
    drawBottle(props, bottle[0], bottle[1], bottle[2], bottle[3])
  }
  for (const tuft of [
    [16, 16],
    [200, 16],
    [388, 16],
    [14, 150],
    [14, 272],
    [200, 272],
    [300, 272],
    [388, 180],
    [60, 230],
    [250, 30],
  ] as const) {
    drawWeedTuft(props, tuft[0], tuft[1])
  }
  root.addChild(props)

  // Mỗi món ĐỨNG là một node depth theo đường chân của nó — vẽ từ ĐÚNG danh sách mà
  // `walkable` dựng đế chặn, nên art và va chạm không thể lệch nhau.
  for (const prop of ALLEY_PROPS) drawProp(depthArt(actors, prop.y), prop)

  // Hai món NẰM: bước qua được nên không khai đế. Pallet và thùng phuy đổ đã dời ra
  // khỏi sân chừa trống (`looseBay`) — chúng nằm đè lên đúng chỗ món rời hiện ra.
  drawPallet(depthArt(actors, 238), 168, 238)
  drawFlatTire(depthArt(actors, 136), 80, 136, 6.4)
  drawTippedDrum(depthArt(actors, 208), 330, 208, 0x9c5a48, 0xba7059)
  drawTippedBin(depthArt(actors, TIPPED_BIN.y), TIPPED_BIN.x, TIPPED_BIN.y)

  // Vành của thửa này: hai node depth — mặt sau (bắc + hai hông) ở đường chân bắc, mặt
  // tiền (các đoạn nam) ở đường chân nam — nên người chơi đứng trong bãi được mặt tiền
  // che, đứng ngoài thì che nó. Một node tĩnh duy nhất là hỏng luật hình #4.
  const alleyLayout = ZONE_LAYOUTS.alley
  if (alleyLayout) {
    const ring = alleyLayout.outline ?? []
    const top = Math.min(...ring.map((point) => point.y))
    const bottom = Math.max(...ring.map((point) => point.y))
    drawZoneRing(depthArt(actors, top), alleyLayout, 'back')
    drawZoneRing(depthArt(actors, bottom), alleyLayout, 'front')
  }

  // Đống gom MỘT MỐI: bao thợ nhặt mang về chất tại điểm đổ, lớn dần theo tồn `scrap`
  // (đầy = thợ nhặt đứng chờ, porter hết bao để vác). Nằm trong lớp depth nên người
  // đi ngang sẽ che/được che đúng theo y.
  const scrapPile = depthArt(actors, dropoff.y - 2)
  scrapPile.label = 'warehouse'

  const life = createAlleyLife(piles, [
    BIN_A,
    BIN_B,
    TIPPED_BIN,
    ...LOOSE_BAGS,
    { x: dropoff.x, y: dropoff.y - 2 },
  ])

  const particles = new Particles()
  const popups = createPopups()
  // Phím "F" treo ngay tại món trong tầm: vẽ SAU actors nên luôn nổi trên đống/thùng
  // (đúng thứ tự của một dấu hiệu UI, không phải vật trong bãi).
  const pickTag = createPickTag()
  // Ruồi/chuột/hải âu + thùng phuy đốt nằm TRÊN lớp depth (đống bao, thùng rác, lốp).
  root.addChild(actors, life.container, particles.container, popups.container, pickTag.container)

  const pickers: PickerActor[] = []
  const porters: PorterActor[] = []
  let desiredPickers = 0
  let desiredPorters = 0
  let ambient: SceneWind = CALM_WIND
  let stock01 = -1
  let pileLevel = -1

  const pileFullMark = new Graphics().rect(dropoff.x - 2, dropoff.y - 32, 4, 4).fill(0xd9534f)
  pileFullMark.visible = false
  root.addChild(pileFullMark)

  // Món rời nhặt được: mỗi món một node depth riêng (y = đường chân) để y-sort đúng —
  // nhân vật đi ra sau/trước mẩu sắt như mọi diễn viên. Chỉ dựng/xoá node khi danh sách
  // đổi; `setState` chạy mỗi nhịp feed nên không được dựng lại từ đầu.
  const looseNodes = new Map<number, Container>()

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

    const loose = state.loose ?? []
    const live = new Set(loose.map((piece) => piece.id))
    for (const [id, node] of looseNodes) {
      if (live.has(id)) continue
      node.parent?.removeChild(node)
      node.destroy({ children: true })
      looseNodes.delete(id)
    }
    for (const piece of loose) {
      if (looseNodes.has(piece.id)) continue
      const art = new Graphics()
      art.position.set(0, -piece.y)
      drawLooseScrap(art, piece.x, piece.y, piece.id)
      const node = new Container()
      node.position.set(0, piece.y)
      node.addChild(art)
      actors.addChild(node)
      looseNodes.set(piece.id, node)
    }

    // Dấu hiệu nhặt: feed chỉ nói ID món đang trong tầm + chữ "GIỮ"/"HOLD" đã dịch;
    // scene tra `loose` để lấy đúng chỗ món — người chơi đi ngang là thấy dấu hiệu
    // treo ngay trên mẩu sắt đó.
    const pick = state.pick ?? null
    const picked = pick === null ? undefined : loose.find((piece) => piece.id === pick)
    pickTag.set(picked ? { x: picked.x, y: picked.y } : null, state.labels.hold)
  }

  const update = (dt: number, elapsed: number): void => {
    pileFullMark.visible = stock01 >= 0.99 && Math.floor(elapsed * 2) % 2 === 0
    for (let i = 0; i < desiredPickers; i++) {
      pickers[i]?.update(dt, particles, popups)
    }
    for (let i = 0; i < desiredPorters; i++) {
      porters[i]?.update(dt, particles)
    }
    // Vẽ theo chiều sâu: ai ở y lớn hơn (gần người xem) vẽ sau.
    sortByDepth(actors)
    life.update(dt, elapsed, ambient)
    particles.update(dt)
    popups.update(dt)
    pickTag.update(dt, elapsed)
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
