import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { createPicker } from '@ui/scene/focus/alley/actors'
import { Particles } from '@ui/scene/focus/parts'
import { createPopups } from '@ui/scene/focus/popups'
import type { Spot } from '@ui/scene/focus/types'

/** Popup labels draw through a stub in node — the real one needs a DOM canvas. */
function stubLabel(text: string): Container {
  const node = new Container()
  node.label = text
  return node
}

describe('alley picker actor', () => {
  it('pokes cans into the bag with a popup, then empties it at the drop-off', () => {
    const piles: Spot[] = [
      { x: 60, y: 40 },
      { x: 96, y: 70 },
    ]
    const dropoff: Spot = { x: 170, y: 52 }
    const actor = createPicker(0, piles, dropoff)
    const particles = new Particles()
    const popups = createPopups(stubLabel)
    popups.setLabels({ produced: 'Sắt vụn', money: 'Tiền' })

    // The bag swells as poke beats land and only resets when the trip is emptied;
    // every landed can also floats a "+1 Sắt vụn" popup over the head.
    let sawFilled = false
    let sawEmptied = false
    let sawPopup = false
    for (let frame = 0; frame < 60 * 60 && !sawEmptied; frame++) {
      actor.update(1 / 60, particles, popups)
      particles.update(1 / 60)
      popups.update(1 / 60)
      const fill = actor.sprite.bag.container.scale.x
      if (fill > 1.01) sawFilled = true
      else if (sawFilled) sawEmptied = true
      if (popups.container.children.some((child) => child.label === '+1 Sắt vụn')) {
        sawPopup = true
      }
    }

    expect(sawFilled).toBe(true)
    expect(sawEmptied).toBe(true)
    expect(sawPopup).toBe(true)
    expect(Number.isFinite(actor.sprite.container.x)).toBe(true)
    expect(Number.isFinite(actor.sprite.container.y)).toBe(true)
  })
})
