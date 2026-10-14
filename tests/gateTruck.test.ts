import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { LANE_Y, createTruck } from '@ui/scene/focus/gate/actors'
import { CRATE_STACK } from '@ui/scene/focus/gate/scene'
import { Particles } from '@ui/scene/focus/parts'
import { createPopups } from '@ui/scene/focus/popups'
import { CALM_WIND } from '@ui/scene/weather'

/** Popup labels draw through a stub in node — the real one needs a DOM canvas. */
function stubLabel(text: string): Container {
  const node = new Container()
  node.label = text
  return node
}

const ZONE_WIDTH = 256
/** Zone width + the access lane running on to the map edge (world x 1280). */
const MAP_EDGE_X = ZONE_WIDTH + 164
/** Cửa cuốn nằm ở đuôi tây của sprite xe (đuôi là đầu tiên lùi vào dock). */
const DOOR_OFFSET = -28
const FRAME = 1 / 60

describe('gate truck actor', () => {
  it('cycles arrive/load/depart with a working roll door and one "+ Tiền" per crossing', () => {
    const truck = createTruck(0, ZONE_WIDTH)
    const particles = new Particles()
    const popups = createPopups(stubLabel)
    popups.setLabels({ produced: 'Sắt vụn', money: 'Tiền' })

    const phases = new Set<string>()
    let sawMoneyPopup = false
    for (let frame = 0; frame < 60 * 40; frame++) {
      truck.update(FRAME, particles, popups)
      particles.update(FRAME)
      popups.update(FRAME)
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

  it('backs in from the city road, docks the door at the crate stack and only vanishes past the map edge', () => {
    const truck = createTruck(0, ZONE_WIDTH)
    const particles = new Particles()
    const popups = createPopups(stubLabel)
    popups.setLabels({ produced: 'Sắt vụn', money: 'Tiền' })

    // Spawns out on the road past the map edge, not inside the yard or on the lane.
    expect(truck.getX()).toBeGreaterThan(MAP_EDGE_X)

    let previous = truck.getX()
    let inDelta = 0
    let outDelta = 0
    let parkedDoorX = Number.NaN
    for (let frame = 0; frame < 60 * 40; frame++) {
      const phase = truck.getPhase()
      truck.update(FRAME, particles, popups)
      particles.update(FRAME)
      popups.update(FRAME)
      const x = truck.getX()
      const delta = x - previous
      previous = x
      // No teleports while it is on the road: the fastest leg is 132 px/s (~2.2 px
      // a frame); the only jump left is the off-map respawn during 'wait'.
      if (phase !== 'wait') expect(Math.abs(delta)).toBeLessThanOrEqual(3)
      // Hidden only once the whole hull is past the map edge — never on the road.
      if (!truck.sprite.container.visible) expect(x).toBeGreaterThan(MAP_EDGE_X + 24)
      if (phase === 'arrive' && delta !== 0) inDelta += delta
      if (phase === 'depart' && delta !== 0) outDelta += delta
      if (phase === 'load') parkedDoorX = x + DOOR_OFFSET
    }

    // Reverses in (x falls) and drives out nose-first (x rises).
    expect(inDelta).toBeLessThan(0)
    expect(outDelta).toBeGreaterThan(0)
    // Parked, the roll door starts right beside the crate stack the sacks come from.
    expect(Number.isFinite(parkedDoorX)).toBe(true)
    expect(Math.abs(parkedDoorX - CRATE_STACK.x)).toBeLessThanOrEqual(12)
  })

  it('keeps the second truck out on the road while the first works the dock', () => {
    const first = createTruck(0, ZONE_WIDTH)
    const second = createTruck(1, ZONE_WIDTH)
    const particles = new Particles()
    const popups = createPopups(stubLabel)
    popups.setLabels({ produced: 'Sắt vụn', money: 'Tiền' })
    const onMap = (x: number): boolean => x < MAP_EDGE_X

    const entered = new Set<number>()
    let turn = 0
    for (let frame = 0; frame < 60 * 60; frame++) {
      // Same turn rule the scene runs: the dock/lane is worked by one truck at a time.
      first.update(FRAME, particles, popups, CALM_WIND, turn === 0)
      second.update(FRAME, particles, popups, CALM_WIND, turn === 1)
      if (onMap(first.getX())) entered.add(0)
      if (onMap(second.getX())) entered.add(1)
      // Never two hulls on the road: the truck without the turn waits outside the map.
      expect(onMap(first.getX()) && onMap(second.getX())).toBe(false)
      if (turn === 0 && first.getPhase() === 'wait') turn = 1
      else if (turn === 1 && second.getPhase() === 'wait') turn = 0
    }

    expect(entered.has(0)).toBe(true)
    expect(entered.has(1)).toBe(true)
  })
})
