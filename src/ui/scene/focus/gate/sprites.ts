import { Container, Graphics } from 'pixi.js'
import { SHADOW, createCrateBox, createSpokeWheel, drawCabDriver, type SpokeWheel } from '../parts'

export interface TruckSprite {
  container: Container
  wheels: SpokeWheel[]
  doorClosed: Graphics
  doorOpen: Graphics
}

/**
 * Chồng kiện chờ bốc lên xe ở cổng bắc: "kho" nhìn thấy được của khu `gate`
 * (tồn `crate`), vẽ lại theo độ đầy thật.
 */
export function drawCrateStack(stack: Container, x: number, baseY: number, count: number): void {
  for (const child of stack.removeChildren()) {
    child.destroy()
  }
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 2)
    const col = i % 2
    const crate = createCrateBox(1)
    crate.position.set(x + col * 12 + (row % 2) * 2, baseY - 8.5 - row * 8)
    stack.addChild(crate)
  }
}

/** Container shells — weathered paint per variant. */
interface Shell {
  body: number
  dark: number
}

const DEFAULT_SHELL: Shell = { body: 0xc2604f, dark: 0x9c4a3d }
const SHELLS: readonly Shell[] = [
  DEFAULT_SHELL,
  { body: 0x4f7fc2, dark: 0x3d66a0 },
  { body: 0x5f9e52, dark: 0x4a7f41 },
]

const CABIN = 0x7fa4d9
const GLASS = 0xcfe0ef
const METAL = 0x8a919c
const METAL_DARK = 0x4d5560
const SKIRT = 0x3a4048
const SKIRT_DARK = 0x1f232a
const SHUTTER = 0x99a0b0
const TAILLIGHT = 0xd94b3a
const PLATE = 0xe8d67a

/**
 * ¾-view export truck, standing on its wheels like the route fleet (origin =
 * ground under the centre, faces +x): container-style box with corrugated
 * panels, corner posts and a marking band, blue cab with the driver behind the
 * side glass, and the roll door on the exposed west end — `doorClosed` /
 * `doorOpen` are toggled by the actor while sacks arc in through the opening.
 * Same block recipe as the rest of the fleet: lit roof plane, mid side face,
 * dark chassis skirt touching the wheels, contact shadow.
 */
export function createTruckSprite(variant: number): TruckSprite {
  const shell = SHELLS[variant % SHELLS.length] ?? DEFAULT_SHELL

  const container = new Container()
  const shadow = new Graphics().ellipse(0, 0.8, 27, 5.6).fill(SHADOW)

  const wheels: SpokeWheel[] = []
  for (const [nearX, farX] of [
    [-10, -12.5],
    [-18, -20.5],
    [13, 10.5],
  ] as const) {
    const far = createSpokeWheel(4)
    far.container.position.set(farX, -4)
    const near = createSpokeWheel(4)
    near.container.position.set(nearX, -4)
    wheels.push(far, near)
  }

  const body = new Graphics()
  // thùng container: mặt hông nam — tôn sóng dọc + ray trên/dưới + trụ góc
  body.rect(-26, -21, 36, 12.4).fill(shell.body)
  for (let x = -24; x < 8; x += 4) {
    body.rect(x, -20.4, 0.6, 11).fill({ color: 0x000000, alpha: 0.1 })
    body.rect(x + 2.2, -20.4, 0.5, 11).fill({ color: 0xffffff, alpha: 0.05 })
  }
  body.rect(-26, -21, 36, 1.4).fill(shell.dark)
  body.rect(-26, -21, 36, 0.6).fill({ color: 0xffffff, alpha: 0.16 })
  body.rect(-26, -10.6, 36, 2).fill(shell.dark)
  body.rect(-26, -21, 2.2, 12.4).fill(shell.dark)
  body.rect(7.8, -21, 2.2, 12.4).fill(shell.dark)
  // dải mã thùng + vệt gỉ
  body.rect(-24, -19.2, 14, 2.2).fill({ color: 0xf0ece2, alpha: 0.9 })
  body.rect(-23, -18.6, 3, 1).fill({ color: 0x2b2f36, alpha: 0.8 })
  body.rect(-18.6, -18.6, 5, 1).fill({ color: 0x2b2f36, alpha: 0.6 })
  body.rect(-12.4, -18.6, 1.8, 1).fill({ color: 0x2b2f36, alpha: 0.7 })
  body.rect(-6.5, -17.5, 0.8, 5.5).fill({ color: 0x6b3a2e, alpha: 0.35 })
  body.rect(1.5, -16.5, 0.8, 4).fill({ color: 0x6b3a2e, alpha: 0.3 })
  // nóc phẳng nhô + casting góc
  body.rect(-26, -22.4, 36, 1.6).fill(shell.body)
  body.rect(-26, -22.4, 36, 0.7).fill({ color: 0xffffff, alpha: 0.22 })
  body.rect(-26, -22.4, 1.8, 1.6).fill(shell.dark)
  body.rect(8.2, -22.4, 1.8, 1.6).fill(shell.dark)
  // đuôi container (mặt tây hơi lộ) — nền cho cửa cuốn
  body.rect(-28.4, -22.4, 2.4, 15.8).fill(shell.dark)
  body.rect(-28.4, -22.4, 2.4, 0.7).fill({ color: 0xffffff, alpha: 0.12 })
  // gầm chạy hết chiều dài: dải xám → gầm đặc chạm bánh → viền gầm + bình dầu + chắn bùn
  body.rect(-28.8, -8.6, 52.8, 2.2).fill(METAL_DARK)
  body.rect(-28.8, -6.4, 52.8, 2.6).fill(SKIRT)
  body.rect(-28.8, -3.8, 52.8, 0.6).fill(SKIRT_DARK)
  body.rect(-3, -9.4, 5.4, 2.6).fill(METAL)
  body.rect(-1.2, -9.4, 0.6, 2.6).fill({ color: 0x000000, alpha: 0.25 })
  body.rect(-21.6, -3.8, 2.6, 2.6).fill(SKIRT_DARK)
  body.rect(-13.6, -3.8, 2.6, 2.6).fill(SKIRT_DARK)
  body.rect(9.4, -3.8, 2.6, 2.6).fill(SKIRT_DARK)
  // ca-bin: hông + kính + nóc + gương
  body.rect(10, -18.6, 10, 10).fill(CABIN)
  body.rect(10, -18.6, 10, 0.8).fill({ color: 0xffffff, alpha: 0.2 })
  body.rect(11.2, -17.6, 5.6, 5).fill(GLASS)
  body.rect(11.2, -17.6, 5.6, 0.7).fill({ color: 0xffffff, alpha: 0.3 })
  body.rect(11.2, -17.6, 5.6, 5).stroke({ width: 0.6, color: 0x3a4048 })
  body.rect(9.4, -19.8, 11.2, 1.4).fill(CABIN)
  body.rect(9.4, -19.8, 11.2, 0.6).fill({ color: 0xffffff, alpha: 0.24 })
  body.rect(9.2, -21, 1.8, 1.8).fill(METAL_DARK)
  // mũi đông: mũi + đèn pha + lưới + cản
  body.rect(20, -14, 2.6, 5.6).fill(CABIN)
  body.rect(20.2, -13.4, 1.8, 1.6).fill(0xffe9a8)
  body.rect(20.2, -10.4, 1.8, 1.8).fill(METAL_DARK)
  body.rect(22.4, -9.6, 1.6, 3.4).fill(METAL)
  // đuôi gầm: đèn hậu + biển số
  body.rect(-28.6, -8.2, 1.6, 2).fill(TAILLIGHT)
  body.rect(-28.4, -5.8, 1.6, 2.2).fill(PLATE)

  // cửa cuốn đuôi: đóng = kín + tay nắm; mở = cuốn lên đỉnh + lòng thùng tối
  const doorClosed = new Graphics()
  doorClosed.rect(-28.4, -21.6, 2.4, 11.6).fill(SHUTTER)
  for (const y of [-19.4, -16.9, -14.4, -11.9]) {
    doorClosed.rect(-28.4, y, 2.4, 0.7).fill({ color: 0x000000, alpha: 0.18 })
  }
  doorClosed.rect(-28.8, -16.6, 1.4, 2.6).fill(METAL)
  doorClosed.rect(-28.8, -16.6, 1.4, 0.7).fill({ color: 0xffffff, alpha: 0.25 })

  const doorOpen = new Graphics()
  doorOpen.rect(-28.6, -22.6, 2.8, 2.4).fill(SHUTTER)
  doorOpen.rect(-28.6, -22.6, 2.8, 0.8).fill({ color: 0xffffff, alpha: 0.25 })
  doorOpen.rect(-28.4, -20.2, 2.4, 10.2).fill(0x1a1d24)
  doorOpen.rect(-28.2, -11.6, 2, 2.2).fill(0xcdb184)
  doorOpen.visible = false

  const driver = drawCabDriver(11.6, -17.4, 0xd9a860)
  const glassShine = new Graphics()
  glassShine.rect(11.2, -17.6, 3.4, 5).fill({ color: 0xffffff, alpha: 0.16 })

  container.addChild(
    shadow,
    ...wheels.map((wheel) => wheel.container),
    body,
    doorClosed,
    doorOpen,
    driver,
    glassShine,
  )
  return { container, wheels, doorClosed, doorOpen }
}
