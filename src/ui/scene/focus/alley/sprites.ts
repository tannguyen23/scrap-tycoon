import { Container, Graphics } from 'pixi.js'
import { createPersonSprite } from '../parts'

export interface PickerSprite {
  container: Container
  body: Container
  face: Graphics
  legsL: Graphics
  legsR: Graphics
  armsL: Container
  armsR: Container
  bag: Container
}

/** Tilted ¾-view scavenger: straw hat + face, with a bag on the back. */
export function createPickerSprite(variant: number): PickerSprite {
  const person = createPersonSprite(variant, 'straw')

  const bag = new Container()
  bag.addChild(
    new Graphics().rect(0, 0, 7, 8).fill(0xe0c79c),
    new Graphics().rect(1, 0, 5, 2.4).fill(0xcdb184),
    new Graphics().rect(2, 0, 3, 1).fill(0xa3804f),
  )
  bag.position.set(-9, -12)
  bag.visible = false
  // Carried on the back: behind the torso and the swinging arm, above the shadow.
  person.container.addChildAt(bag, 1)

  return {
    container: person.container,
    body: person.body,
    face: person.face,
    legsL: person.legsL,
    legsR: person.legsR,
    armsL: person.armsL,
    armsR: person.armsR,
    bag,
  }
}