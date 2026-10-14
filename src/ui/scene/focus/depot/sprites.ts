import { Container, Graphics } from 'pixi.js'
import { createPalletLoad, createSack, createPersonSprite } from '../parts'

export interface HaulerSprite {
  container: Container
  body: Container
  face: Graphics
  legsL: Graphics
  legsR: Graphics
  armsL: Container
  armsR: Container
  sack: Container
}

/**
 * Chồng pallet phôi xe ba gác trút xuống cạnh cổng kho: "kho" nhìn thấy được của
 * khu `depot` (tồn `pallet`), vẽ lại theo độ đầy thật.
 */
export function drawPalletStack(stack: Container, x: number, baseY: number, count: number): void {
  for (const child of stack.removeChildren()) {
    child.destroy()
  }
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 2)
    const col = i % 2
    const pallet = createPalletLoad(0.7)
    pallet.position.set(x + col * 13 + (row % 2) * 2, baseY - row * 7)
    stack.addChild(pallet)
  }
}

/** Tilted ¾-view depot hauler: cap + face, with a sack carried out front. */
export function createHaulerSprite(variant: number): HaulerSprite {
  const person = createPersonSprite(variant, 'cap')

  const sack = new Container()
  sack.addChild(createSack(0.85))
  sack.position.set(3, -11)
  sack.visible = false
  person.container.addChild(sack)

  return {
    container: person.container,
    body: person.body,
    face: person.face,
    legsL: person.legsL,
    legsR: person.legsR,
    armsL: person.armsL,
    armsR: person.armsR,
    sack,
  }
}