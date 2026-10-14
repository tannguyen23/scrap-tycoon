import { Container, Graphics } from 'pixi.js'
import { createPersonSprite } from '../parts'

export interface SmithSprite {
  container: Container
  body: Container
  face: Graphics
  legsL: Graphics
  legsR: Graphics
  armsL: Container
  armsR: Container
  /** Bao phế liệu vác vào lò. */
  sack: Container
  /** Phôi rèn xong mang ra chồng pallet. */
  billet: Container
}

/** Thỏi phôi tái chế: thép xám, đầu còn nóng ran cam. */
export function createBillet(): Container {
  const container = new Container()
  const bar = new Graphics()
  bar.rect(-3.6, -1.2, 7.2, 2.4).fill(0x8b939c)
  bar.rect(-3.6, -1.2, 7.2, 0.9).fill({ color: 0xdfe6ec, alpha: 0.85 })
  bar.rect(-3.6, 0.7, 7.2, 0.5).fill({ color: 0x000000, alpha: 0.18 })
  bar.rect(3.2, -1.5, 1.6, 3).fill({ color: 0xffb45a, alpha: 0.9 })
  bar.rect(4.2, -1.1, 0.8, 2.2).fill({ color: 0xffe9b8, alpha: 0.85 })
  container.addChild(bar)
  return container
}

/** Tilted ¾-view forge worker: cap + sledge kit (equipped by the HAMMER action). */
export function createSmithSprite(variant: number): SmithSprite {
  const person = createPersonSprite(variant, 'cap')

  const sack = new Container()
  sack.addChild(new Graphics().rect(-4.4, -5, 8.8, 9.6).fill(0xc9bfa6))
  sack.addChild(new Graphics().rect(-4.4, -5, 8.8, 1.6).fill({ color: 0xf5ecd6, alpha: 0.7 }))
  sack.position.set(3, -11)
  sack.visible = false

  const billet = createBillet()
  billet.position.set(3, -11)
  billet.visible = false

  person.container.addChild(sack, billet)

  return {
    container: person.container,
    body: person.body,
    face: person.face,
    legsL: person.legsL,
    legsR: person.legsR,
    armsL: person.armsL,
    armsR: person.armsR,
    sack,
    billet,
  }
}
