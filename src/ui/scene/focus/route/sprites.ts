import { Container, Graphics } from 'pixi.js'
import { SHADOW, createSack, createSpokeWheel, type SpokeWheel } from '../parts'

export interface CartSprite {
  container: Container
  wheels: SpokeWheel[]
}

/**
 * Top-down three-wheel cart: cargo box with sacks seen from above, two rear
 * wheels + one front wheel poking out, handlebar and a driver seated behind it
 * with both arms reaching the bar.
 */
export function createCartSprite(variant: number): CartSprite {
  const WOODS = [0xa8834f, 0x97723f, 0xb08d58]
  const wood = WOODS[variant % WOODS.length] ?? 0xa8834f

  const container = new Container()
  const shadow = new Graphics().ellipse(1, 3, 19, 10).fill(SHADOW)

  const wheels: SpokeWheel[] = []
  const wheelRearTop = createSpokeWheel(4)
  wheelRearTop.container.position.set(-10, -8)
  const wheelRearBottom = createSpokeWheel(4)
  wheelRearBottom.container.position.set(-10, 4)
  const wheelFront = createSpokeWheel(3.8)
  wheelFront.container.position.set(14.8, -3.8)
  wheels.push(wheelRearTop, wheelRearBottom, wheelFront)

  const box = new Graphics().rect(-14, -8, 22, 16).fill(wood)
  box.rect(-14, -4, 22, 1).fill({ color: 0x000000, alpha: 0.16 })
  box.rect(-14, 3, 22, 1).fill({ color: 0x000000, alpha: 0.16 })
  box.rect(-14, 6, 22, 2).fill({ color: 0x000000, alpha: 0.2 })
  box.rect(-14, -8, 22, 2).fill({ color: 0xffffff, alpha: 0.06 })
  const nails = new Graphics()
    .rect(-13, -7, 1, 1)
    .fill(0x74818f)
    .rect(-13, 6, 1, 1)
    .fill(0x74818f)
    .rect(-1, -7, 1, 1)
    .fill(0x74818f)
    .rect(-1, 6, 1, 1)
    .fill(0x74818f)

  const sackA = createSack(0.9)
  sackA.position.set(-12, -3.6)
  const sackB = createSack(0.75)
  sackB.position.set(-5, 0.4)

  // tay lái ngang + trục xuống bánh trước
  const handle = new Graphics().rect(8, -5, 1.5, 10).fill(0x8b6e4e)
  const stem = new Graphics().rect(9, -1.2, 5.8, 2.4).fill(0x785c3c)

  // tài xế nhìn từ sau (¾): lưng + vai + hai tay với tới tay lái
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
  const torso = new Graphics().rect(-5, -4, 10, 8).fill(0x7a6a9f)
  const collar = new Graphics().rect(-3, -4, 6, 1.6).fill({ color: 0xffffff, alpha: 0.14 })
  const back = new Graphics().rect(-3.2, 4, 6.4, 4).fill(0x6a5a8f)
  const cap = new Graphics().rect(-4.4, -4.4, 8.8, 8.8).fill(0xd9a860)
  const capShine = new Graphics().rect(-3.2, -3.2, 3.2, 3.2).fill({ color: 0xffffff, alpha: 0.18 })
  driver.addChild(back, arms, hands, torso, collar, cap, capShine)
  driver.position.set(-7, 0)

  container.addChild(
    shadow,
    wheelRearTop.container,
    wheelRearBottom.container,
    wheelFront.container,
    box,
    nails,
    sackA,
    sackB,
    handle,
    stem,
    driver,
  )
  return { container, wheels }
}