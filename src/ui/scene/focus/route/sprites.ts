import { Container, Graphics } from 'pixi.js'
import { SHADOW, createSack, createScrapBit, createSpokeWheel, drawCabDriver, type SpokeWheel } from '../parts'
import { createBillet } from '../recycle/sprites'

export interface VehicleSprite {
  container: Container
  wheels: SpokeWheel[]
}

/**
 * Chồng phôi chờ ba gác ở ngã ba làn xưởng → mặt đường: đây là "kho" nhìn thấy
 * được của khu `route` (tồn `billet`), vẽ lại theo độ đầy thật.
 */
export function drawBilletStack(stack: Container, x: number, baseY: number, count: number): void {
  for (const child of stack.removeChildren()) {
    child.destroy()
  }
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 4)
    const col = i % 4
    const bar = createBillet()
    bar.position.set(x - 15 + col * 10 + (row % 2) * 3, baseY - row * 4.5)
    stack.addChild(bar)
  }
}

/** One livery per colour variant — the accent + tarp + driver stay a matched set. */
interface FleetPalette {
  accent: number
  tarp: number
  body: number
  /**
   * Tông mặt ĐUÔI (mặt tây hơi lộ). Xe bị lật `scale.x` khi chạy chiều ngược nên
   * đừng tô chênh mạnh so với `body`: để gần nhau để cả hai chiều đều không phản
   * chủ về sáng-tối (xem luật hình trong AGENTS).
   */
  bodyDark: number
  cabin: number
  driverShirt: number
  driverShirtDark: number
  driverCap: number
}

const DEFAULT_PALETTE: FleetPalette = {
  accent: 0xc2493d,
  tarp: 0x4f7fc2,
  body: 0x79b4d9,
  bodyDark: 0x74afd3,
  cabin: 0xe8e4da,
  driverShirt: 0x7a6a9f,
  driverShirtDark: 0x625483,
  driverCap: 0xd9a860,
}

const PALETTES: readonly FleetPalette[] = [
  DEFAULT_PALETTE,
  {
    accent: 0x3f8f7a,
    tarp: 0xb8534a,
    body: 0xd08a5a,
    bodyDark: 0xc98554,
    cabin: 0xe0d8c8,
    driverShirt: 0x6a7a9f,
    driverShirtDark: 0x556380,
    driverCap: 0xd97b60,
  },
  {
    accent: 0xd9a23f,
    tarp: 0x5f9e52,
    body: 0x8fbf6f,
    bodyDark: 0x8aba69,
    cabin: 0xd8d2e0,
    driverShirt: 0x8f6a5a,
    driverShirtDark: 0x745548,
    driverCap: 0x6fa0e0,
  },
]

function paletteOf(variant: number): FleetPalette {
  return PALETTES[variant % PALETTES.length] ?? DEFAULT_PALETTE
}

const WOOD_TOPS = [0xb0905c, 0x9d7d4c, 0xbba478]
const WOOD_SIDE = 0x8a6a3e
/** Mặt đuôi xe cút kít — gần tông hông (xe lật hai chiều, xem `bodyDark`). */
const WOOD_BACK = 0x82633f
const TAILLIGHT = 0xd94b3a
const PLATE = 0xe8d67a
const GLASS = 0xcfe0ef
const METAL = 0x8a919c
const METAL_DARK = 0x4d5560
const HAZARD_YELLOW = 0xe8d67a
const HAZARD_DARK = 0x2b2f36
const SKIRT = 0x3a4048
const SKIRT_DARK = 0x1f232a

/**
 * ¾-view fleet of the route lane, drawn standing on its wheels the way the
 * person sprite stands on its feet: origin = ground contact under the centre,
 * the lane line runs through y = 0, everything faces +x so the actor flips
 * `scale.x`. The camera sits behind-left-above, so every body shows its south
 * side (main face), a lit top plane, and a sliver of its rear end.
 *
 * Faces stack like the building recipe (south wall + protruding roof), lit by
 * the same top-left sun: top plane lightest → side face mid (with the painted
 * accent stripe) → dark under-chassis rim → contact shadow. Wheels come in
 * far/near pairs offset on x — the same trick the legs use — so both sides of
 * the axle stay readable.
 */
export function createCartSprite(variant: number): VehicleSprite {
  const pal = paletteOf(variant)
  const deck = WOOD_TOPS[variant % WOOD_TOPS.length] ?? 0xb0905c

  const container = new Container()
  const shadow = new Graphics().ellipse(0, 0.6, 16, 4.2).fill(SHADOW)

  const wheels: SpokeWheel[] = []
  addWheelPair(wheels, 3, -7, -9.5)
  const front = createSpokeWheel(3)
  front.container.position.set(11.5, -3)
  wheels.push(front)

  const body = new Graphics()
  // mặt hông nam của sàn xe: ván dọc + sọc sơn + viền
  body.rect(-12.5, -10.6, 20.5, 5.2).fill(WOOD_SIDE)
  for (let x = -11; x < 8; x += 4) body.rect(x, -10.6, 0.6, 5.2).fill({ color: 0x000000, alpha: 0.12 })
  body.rect(-12.5, -10.6, 20.5, 0.7).fill({ color: 0xffffff, alpha: 0.18 })
  body.rect(-12.5, -8.6, 20.5, 1.2).fill(pal.accent)
  // gầm đặc chạm bánh: bánh nằm dưới gầm, khuất nửa trên như bánh trong hốc
  body.rect(-12.5, -5.4, 20.5, 2.4).fill(SKIRT)
  body.rect(-12.5, -3, 20.5, 0.5).fill(SKIRT_DARK)
  // sàn trên (mái nhô) + đuôi xe hơi lộ
  body.rect(-12.5, -11.6, 20.5, 1.4).fill(deck)
  body.rect(-12.5, -11.6, 20.5, 0.6).fill({ color: 0xffffff, alpha: 0.2 })
  body.rect(-14.3, -11.6, 1.8, 6.2).fill(WOOD_BACK)
  body.rect(-14.3, -11.6, 1.8, 0.6).fill({ color: 0xffffff, alpha: 0.12 })
  body.rect(-14.5, -10.8, 1.4, 1.8).fill(TAILLIGHT)
  body.rect(-14.5, -7.6, 1.5, 2.2).fill(PLATE)
  // trục nối bánh trước vào gầm + chắn bùn
  body.rect(7.4, -5.4, 4.8, 2.4).fill(SKIRT)
  body.rect(9.2, -7.4, 6, 1.8).fill(METAL_DARK)
  body.rect(9.2, -7.4, 6, 0.6).fill({ color: 0xffffff, alpha: 0.12 })

  // tay lái: cột + ghi-đông
  const steering = new Graphics()
  steering.rect(6.6, -14.8, 1.6, 8.4).fill(0x6b5236)
  steering.rect(6.2, -15.4, 5.4, 1.6).fill(METAL)
  steering.rect(6.2, -15.4, 5.4, 0.6).fill({ color: 0xffffff, alpha: 0.2 })

  // hàng trên sàn: bao tải + bạt màu + mảnh sắt
  const sackA = createSack(0.6)
  sackA.position.set(-10.5, -16.4)
  const sackB = createSack(0.5)
  sackB.position.set(-5.6, -15.9)
  const tarp = new Graphics()
  tarp.rect(-11, -14.4, 7.5, 2.9).fill({ color: pal.tarp, alpha: 0.95 })
  tarp.rect(-11, -14.4, 7.5, 0.8).fill({ color: 0xffffff, alpha: 0.2 })
  tarp.rect(-11, -12.4, 7.5, 0.9).fill({ color: 0x000000, alpha: 0.16 })
  const bitA = createScrapBit(0)
  bitA.position.set(2, -13.6)
  const bitB = createScrapBit(1)
  bitB.position.set(4.6, -13.2)

  const driver = drawDriver(pal)
  driver.scale.set(0.7)
  driver.position.set(-5, -11.4)

  container.addChild(
    shadow,
    ...wheels.map((wheel) => wheel.container),
    body,
    steering,
    tarp,
    sackA,
    sackB,
    bitA,
    bitB,
    driver,
  )
  return { container, wheels }
}

/** Pickup truck: low bed with a tarped load, tall cab with the driver behind glass. */
export function createPickupSprite(variant: number): VehicleSprite {
  const pal = paletteOf(variant)

  const container = new Container()
  const shadow = new Graphics().ellipse(0, 0.6, 18, 4.6).fill(SHADOW)

  const wheels: SpokeWheel[] = []
  addWheelPair(wheels, 3.4, -8, -10.8)
  addWheelPair(wheels, 3.4, 12.6, 9.8)

  const body = new Graphics()
  // thân dưới (mặt hông) + sọc sơn + gầm đặc chạm bánh
  body.rect(-15, -9.4, 27, 4).fill(pal.body)
  body.rect(-15, -8.6, 27, 1.1).fill(pal.accent)
  body.rect(-15, -5.4, 30, 2).fill(SKIRT)
  body.rect(-15, -3.4, 30, 0.5).fill(SKIRT_DARK)
  // thành thùng sau (thấp) + viền sáng
  body.rect(-15, -11.4, 13, 2).fill(pal.body)
  body.rect(-15, -11.4, 13, 0.7).fill({ color: 0xffffff, alpha: 0.2 })
  // ca-bin: hông + nóc nhô + kính hậu
  body.rect(-2, -15.5, 14, 6.2).fill(pal.body)
  body.rect(-2, -16.4, 14, 1.4).fill(pal.body)
  body.rect(-2, -16.4, 14, 0.6).fill({ color: 0xffffff, alpha: 0.24 })
  body.rect(0.4, -15.1, 8.4, 5).fill(GLASS)
  body.rect(0.4, -15.1, 8.4, 0.7).fill({ color: 0xffffff, alpha: 0.3 })
  body.rect(0.4, -15.1, 8.4, 5).stroke({ width: 0.6, color: 0x3a4048 })
  // mũi xe + đèn + cản trước
  body.rect(12, -10.6, 3, 5.4).fill(pal.body)
  body.rect(12.4, -9.8, 1.6, 1.8).fill(0xffe9a8)
  body.rect(14.6, -8.6, 1.4, 3.6).fill(METAL)
  // đuôi xe hơi lộ + đèn hậu + biển số + cản sau
  body.rect(-16.6, -11.4, 1.6, 6).fill(pal.bodyDark)
  body.rect(-16.6, -11.4, 1.6, 0.6).fill({ color: 0xffffff, alpha: 0.12 })
  body.rect(-16.8, -10.6, 1.2, 1.8).fill(TAILLIGHT)
  body.rect(-16.8, -7.4, 1.3, 2).fill(PLATE)
  body.rect(-16.8, -5.6, 1.8, 1.4).fill(METAL)
  body.rect(-1.6, -17.2, 1.6, 1.6).fill(METAL_DARK)

  // hàng trong thùng: bao + bạt
  const sack = createSack(0.55)
  sack.position.set(-13.8, -16.2)
  const tarp = new Graphics()
  tarp.rect(-14.5, -13.2, 7, 2.1).fill({ color: pal.tarp, alpha: 0.95 })
  tarp.rect(-14.5, -13.2, 7, 0.7).fill({ color: 0xffffff, alpha: 0.2 })
  const bit = createScrapBit(1)
  bit.position.set(-4.6, -12.6)

  const driver = drawCabDriver(1.2, -14.8, pal.driverCap)
  const glassShine = new Graphics()
  glassShine.rect(0.4, -15.1, 3.4, 5).fill({ color: 0xffffff, alpha: 0.16 })

  container.addChild(
    shadow,
    ...wheels.map((wheel) => wheel.container),
    body,
    tarp,
    sack,
    bit,
    driver,
    glassShine,
  )
  return { container, wheels }
}

/** Route box truck: ribbed painted container, hazard stripe, six wheels. */
export function createRouteTruckSprite(variant: number): VehicleSprite {
  const pal = paletteOf(variant)

  const container = new Container()
  const shadow = new Graphics().ellipse(0, 0.6, 22, 5).fill(SHADOW)

  const wheels: SpokeWheel[] = []
  addWheelPair(wheels, 3.6, -10, -12.5)
  addWheelPair(wheels, 3.6, 3.5, 1)
  addWheelPair(wheels, 3.6, 15.5, 13)

  const body = new Graphics()
  // thùng hàng: mặt hông + gân tôn + sọc cảnh báo vàng-đen + gầm tối
  body.rect(-19, -18.2, 26, 9.2).fill(pal.body)
  for (let x = -16.5; x < 6; x += 5) {
    body.rect(x, -17.4, 0.8, 7.6).fill({ color: 0x000000, alpha: 0.12 })
    body.rect(x + 2.4, -17.4, 0.5, 7.6).fill({ color: 0xffffff, alpha: 0.05 })
  }
  for (let x = -19; x < 7; x += 4) {
    body.rect(x, -10.8, 2, 1.8).fill(HAZARD_YELLOW)
    body.rect(x + 2, -10.8, 2, 1.8).fill(HAZARD_DARK)
  }
  // gầm chạy hết chiều dài: dải xám dưới thùng → gầm đặc chạm bánh → viền gầm
  body.rect(-19, -9, 38.4, 2.4).fill(METAL_DARK)
  body.rect(-19, -6.6, 38.4, 3).fill(SKIRT)
  body.rect(-19, -3.6, 38.4, 0.6).fill(SKIRT_DARK)
  // nóc nhô + viền sáng
  body.rect(-19, -19.2, 26, 1.4).fill(pal.body)
  body.rect(-19, -19.2, 26, 0.6).fill({ color: 0xffffff, alpha: 0.2 })
  // đuôi thùng hơi lộ: cửa cuốn + tay nắm + đèn + biển số
  body.rect(-20.8, -19.2, 1.8, 12.6).fill(pal.bodyDark)
  body.rect(-20.8, -19.2, 1.8, 0.6).fill({ color: 0xffffff, alpha: 0.12 })
  for (const y of [-15.2, -11.8, -8.6]) body.rect(-20.8, y, 1.8, 0.6).fill({ color: 0x000000, alpha: 0.22 })
  body.rect(-21, -13.4, 1.2, 2.6).fill(METAL)
  body.rect(-21, -18, 1.2, 1.8).fill(TAILLIGHT)
  body.rect(-21, -9.4, 1.2, 1.8).fill(TAILLIGHT)
  body.rect(-21, -14.4, 1.3, 2).fill(PLATE)
  // ca-bin: hông + nóc + kính hậu + mũi + cản
  body.rect(7, -15.8, 9, 7.8).fill(pal.cabin)
  body.rect(6.4, -17, 10, 1.4).fill(pal.cabin)
  body.rect(6.4, -17, 10, 0.6).fill({ color: 0xffffff, alpha: 0.26 })
  body.rect(8.2, -15.2, 5.6, 5).fill(GLASS)
  body.rect(8.2, -15.2, 5.6, 0.7).fill({ color: 0xffffff, alpha: 0.3 })
  body.rect(8.2, -15.2, 5.6, 5).stroke({ width: 0.6, color: 0x3a4048 })
  body.rect(16, -11.6, 2.5, 4.8).fill(pal.cabin)
  body.rect(16.4, -10.6, 1.4, 1.8).fill(0xffe9a8)
  body.rect(18, -8.6, 1.4, 3).fill(METAL)
  body.rect(6.6, -18, 1.6, 1.6).fill(METAL_DARK)
  // chắn bùn treo từ mép gầm, rủ xuống trước bánh
  body.rect(-14.6, -3.6, 2.6, 2.4).fill(HAZARD_DARK)
  body.rect(-1.2, -3.6, 2.6, 2.4).fill(HAZARD_DARK)
  body.rect(10.8, -3.6, 2.6, 2.4).fill(HAZARD_DARK)

  const driver = drawCabDriver(8.8, -15, pal.driverCap)
  const glassShine = new Graphics()
  glassShine.rect(8.2, -15.2, 3, 5).fill({ color: 0xffffff, alpha: 0.16 })

  container.addChild(shadow, ...wheels.map((wheel) => wheel.container), body, driver, glassShine)
  return { container, wheels }
}

/** Vehicle used by the route lane at a given upgrade tier (0 cart → 2 box truck). */
export function routeVehicleSprite(tier: number, variant: number): VehicleSprite {
  if (tier >= 2) return createRouteTruckSprite(variant)
  if (tier === 1) return createPickupSprite(variant)
  return createCartSprite(variant)
}

/** Far + near wheel of one axle, both standing on the ground line (y = 0). */
function addWheelPair(wheels: SpokeWheel[], radius: number, nearX: number, farX: number): void {
  const far = createSpokeWheel(radius)
  far.container.position.set(farX, -radius)
  const near = createSpokeWheel(radius)
  near.container.position.set(nearX, -radius)
  wheels.push(far, near)
}

/** Rear-¾ driver of the open cart: back, shoulders and both arms on the bar. */
function drawDriver(pal: FleetPalette): Container {
  const driver = new Container()
  const arms = new Graphics()
    .rect(0, -5.2, 14.4, 2.4)
    .fill(0xe8c099)
    .rect(0, 2.8, 14.4, 2.4)
    .fill(0xe8c099)
  const hands = new Graphics()
    .rect(14, -5.4, 2.4, 2.8)
    .fill(0xe8c099)
    .rect(14, 2.6, 2.4, 2.8)
    .fill(0xe8c099)
  const torso = new Graphics().rect(-5, -4, 10, 8).fill(pal.driverShirt)
  const collar = new Graphics().rect(-3, -4, 6, 1.6).fill({ color: 0xffffff, alpha: 0.14 })
  const back = new Graphics().rect(-3.2, 4, 6.4, 4).fill(pal.driverShirtDark)
  const cap = new Graphics().rect(-4.4, -4.4, 8.8, 8.8).fill(pal.driverCap)
  const capShine = new Graphics().rect(-3.2, -3.2, 3.2, 3.2).fill({ color: 0xffffff, alpha: 0.18 })
  driver.addChild(back, arms, hands, torso, collar, cap, capShine)
  return driver
}

