import { Container, Graphics } from 'pixi.js'
import { SHADOW, createSpokeWheel, type SpokeWheel } from '../parts'

export interface TruckSprite {
  container: Container
  wheels: SpokeWheel[]
  doorClosed: Graphics
  doorOpen: Graphics
}

/** Detailed truck: ribbed container with a swinging rear door, cab, spoke wheels. */
export function createTruckSprite(variant: number): TruckSprite {
  const BODIES = [0xb4bac8, 0xa8aebc, 0xbfc5d2]
  const body = BODIES[variant % BODIES.length] ?? 0xb4bac8

  const container = new Container()
  const shadow = new Graphics().ellipse(0, 0, 26, 8.4).fill(SHADOW)

  const wheels: SpokeWheel[] = []
  for (const [wx, wy] of [
    [-14, -10.4],
    [0, -10.4],
    [14, -10.4],
    [-14, 6.4],
    [0, 6.4],
    [14, 6.4],
  ] as const) {
    const wheel = createSpokeWheel(4)
    wheel.container.position.set(wx, wy)
    wheels.push(wheel)
  }

  const cargo = new Graphics().rect(-24, -10, 30, 20).fill(body)
  for (let x = -20; x < 6; x += 5) {
    cargo.rect(x, -10, 1, 20).fill({ color: 0x000000, alpha: 0.12 })
  }
  cargo.rect(-24, -10, 30, 2).fill(0x99a0b0)
  cargo.rect(-24, 8, 30, 2).fill(0x99a0b0)
  cargo.rect(-24, 7, 30, 3).fill({ color: 0x000000, alpha: 0.15 })

  const interior = new Graphics().rect(-23, -8, 4, 16).fill(0x3d444e)
  const doorClosed = new Graphics().rect(-25, -9, 2.4, 18).fill(0x99a0b0)
  const doorOpen = new Graphics().rect(-29, -13, 2, 5).fill(0xa8aebc)
  doorOpen.visible = false

  const cab = new Graphics().rect(6, -10, 16, 20).fill(0x7fa4d9)
  cab.rect(6, -10, 16, 2).fill(0x6a8fc4)
  cab.rect(6, 8, 16, 2).fill(0x6a8fc4)
  const windshield = new Graphics().rect(18, -8, 3, 16).fill(0xcfe0ef)
  const lights = new Graphics().rect(21.6, -8, 1.2, 4).fill(0xffe9a8).rect(21.6, 4, 1.2, 4).fill(0xffe9a8)
  const mirrors = new Graphics()
    .rect(23, -14, 3, 3)
    .fill(0x4d5560)
    .rect(23, 11, 3, 3)
    .fill(0x4d5560)
  const hatch = new Graphics().rect(-12, -1.5, 8, 3).fill({ color: 0x000000, alpha: 0.1 })

  container.addChild(
    shadow,
    ...wheels.map((wheel) => wheel.container),
    cargo,
    interior,
    doorClosed,
    doorOpen,
    cab,
    windshield,
    lights,
    mirrors,
    hatch,
  )
  return { container, wheels, doorClosed, doorOpen }
}