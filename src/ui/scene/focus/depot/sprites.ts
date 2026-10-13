import { Container, Graphics } from 'pixi.js'
import { createSack, createPersonSprite } from '../parts'

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