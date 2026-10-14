import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { LANE_Y, createTruck } from '@ui/scene/focus/gate/actors'
import { Particles } from '@ui/scene/focus/parts'
import { createPopups } from '@ui/scene/focus/popups'

/** Popup labels draw through a stub in node — the real one needs a DOM canvas. */
function stubLabel(text: string): Container {
  const node = new Container()
  node.label = text
  return node
}

describe('gate truck actor', () => {
  it('cycles arrive/load/depart with a working roll door and one "+ Tiền" per crossing', () => {
    const truck = createTruck(0, 256)
    const particles = new Particles()
    const popups = createPopups(stubLabel)
    popups.setLabels({ produced: 'Sắt vụn', money: 'Tiền' })

    const phases = new Set<string>()
    let sawMoneyPopup = false
    for (let frame = 0; frame < 60 * 30; frame++) {
      truck.update(1 / 60, particles, popups)
      particles.update(1 / 60)
      popups.update(1 / 60)
      phases.add(truck.getPhase())
      // Exactly one door state, popups never stack (a per-frame spawn would).
      expect(truck.sprite.doorOpen.visible !== truck.sprite.doorClosed.visible).toBe(true)
      expect(popups.container.children.length).toBeLessThanOrEqual(1)
      expect(Math.abs(truck.sprite.container.y - (LANE_Y + 10))).toBeLessThanOrEqual(2)
      if (popups.container.children.some((child) => child.label === '+ Tiền')) {
        sawMoneyPopup = true
      }
    }

    expect(phases.has('arrive')).toBe(true)
    expect(phases.has('load')).toBe(true)
    expect(phases.has('depart')).toBe(true)
    expect(sawMoneyPopup).toBe(true)
  })
})
