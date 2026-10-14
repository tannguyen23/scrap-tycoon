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
/** Cửa cuốn nằm ở đuôi tây của sprite nhìn hông xe. */
const DOOR_OFFSET = -28
const FRAME = 1 / 60

function rig(): {
  truck: ReturnType<typeof createTruck>
  particles: Particles
  popups: ReturnType<typeof createPopups>
} {
  const popups = createPopups(stubLabel)
  popups.setLabels({ produced: 'Sắt vụn', money: 'Tiền' })
  return { truck: createTruck(0, ZONE_WIDTH), particles: new Particles(), popups }
}

describe('gate truck actor', () => {
  it('runs the whole export cycle with a working roll door and one "+ Tiền" per crossing', () => {
    const { truck, particles, popups } = rig()
    const phases = new Set<string>()
    let sawMoneyPopup = false

    for (let frame = 0; frame < 60 * 45; frame++) {
      truck.update(FRAME, particles, popups)
      particles.update(FRAME)
      popups.update(FRAME)
      phases.add(truck.getPhase())
      // Exactly one door state, popups never stack (a per-frame spawn would).
      expect(truck.sprite.doorOpen.visible !== truck.sprite.doorClosed.visible).toBe(true)
      expect(popups.container.children.length).toBeLessThanOrEqual(1)
      // Khi bốc hàng xe đứng đúng trên mặt làn trong sân.
      if (truck.getPhase() === 'load') {
        expect(Math.abs(truck.getY() - (LANE_Y + 10))).toBeLessThanOrEqual(2)
      }
      if (popups.container.children.some((child) => child.label === '+ Tiền')) {
        sawMoneyPopup = true
      }
    }

    expect(phases.has('road')).toBe(true)
    expect(phases.has('turn')).toBe(true)
    expect(phases.has('driveway')).toBe(true)
    expect(phases.has('yard')).toBe(true)
    expect(phases.has('load')).toBe(true)
    expect(phases.has('depart')).toBe(true)
    expect(sawMoneyPopup).toBe(true)
  })

  it('drives every leg nose-first and only vanishes past the map edge', () => {
    const { truck, particles, popups } = rig()
    // Spawns out on the road past the map edge, never inside the yard.
    expect(truck.getX()).toBeGreaterThan(MAP_EDGE_X)

    const movedWest = new Set<string>()
    const movedSouth = new Set<string>()
    const movedEast = new Set<string>()
    let previousX = truck.getX()
    let previousY = truck.getY()
    let parkedDoorX = Number.NaN

    for (let frame = 0; frame < 60 * 45; frame++) {
      const phase = truck.getPhase()
      truck.update(FRAME, particles, popups)
      particles.update(FRAME)
      popups.update(FRAME)
      // Chặng vừa chạy xong (view/hướng nhìn thuộc về trạng thái SAU bước này).
      const view = truck.getPhase()
      const x = truck.getX()
      const y = truck.getY()
      const dx = x - previousX
      const dy = y - previousY
      previousX = x
      previousY = y

      // No teleports while it is on the map: the fastest leg is 132 px/s (~2.2 px
      // a frame); the only jump left is the off-map respawn during 'wait'.
      if (phase !== 'wait') {
        expect(Math.abs(dx)).toBeLessThanOrEqual(3)
        expect(Math.abs(dy)).toBeLessThanOrEqual(3)
      }
      // Hidden (both views) only once the whole hull is past the map edge.
      const hidden = !truck.sprite.container.visible && !truck.front.container.visible
      if (hidden) expect(x).toBeGreaterThan(MAP_EDGE_X + 24)

      // Hướng đi của từng chặng: đường lớn về tây, driveway về nam, sân về đông.
      if (dx < -0.4) movedWest.add(phase)
      if (dx > 0.4) movedEast.add(phase)
      if (dy > 0.4) movedSouth.add(phase)
      if (phase === 'road') expect(dx).toBeLessThanOrEqual(0)
      if (phase === 'driveway') expect(dy).toBeGreaterThanOrEqual(0)
      if (phase === 'yard' || phase === 'depart') expect(dx).toBeGreaterThanOrEqual(0)
      // Mặt xe khớp chiều đi: về tây thì hông xe lật (-1), về đông thì không lật.
      if (view === 'road') expect(truck.sprite.container.scale.x).toBe(-1)
      if (view === 'yard' || view === 'depart' || view === 'load') {
        expect(truck.sprite.container.scale.x).toBe(1)
      }
      // Xuống driveway thì phải nhìn thẳng (view trước), không nhìn hông.
      if (view === 'driveway') {
        expect(truck.front.container.visible).toBe(true)
        expect(truck.sprite.container.visible).toBe(false)
      }
      if (view === 'load') {
        expect(truck.sprite.container.visible).toBe(true)
        expect(truck.front.container.visible).toBe(false)
        parkedDoorX = x + DOOR_OFFSET
      }
    }

    expect(movedWest.has('road')).toBe(true)
    expect(movedSouth.has('driveway')).toBe(true)
    expect(movedEast.has('yard')).toBe(true)
    expect(movedEast.has('depart')).toBe(true)
    // Parked, the roll door starts right beside the crate stack the sacks come from.
    expect(Number.isFinite(parkedDoorX)).toBe(true)
    expect(parkedDoorX).toBeGreaterThan(CRATE_STACK.x)
    expect(parkedDoorX - CRATE_STACK.x).toBeLessThanOrEqual(12)
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
    for (let frame = 0; frame < 60 * 90; frame++) {
      // Same turn rule the scene runs: the dock/lane is worked by one truck at a time.
      first.update(FRAME, particles, popups, CALM_WIND, turn === 0)
      second.update(FRAME, particles, popups, CALM_WIND, turn === 1)
      if (onMap(first.getX())) entered.add(0)
      if (onMap(second.getX())) entered.add(1)
      // Never two hulls on the map: the truck without the turn waits out on the road.
      expect(onMap(first.getX()) && onMap(second.getX())).toBe(false)
      if (turn === 0 && first.getPhase() === 'wait') turn = 1
      else if (turn === 1 && second.getPhase() === 'wait') turn = 0
    }

    expect(entered.has(0)).toBe(true)
    expect(entered.has(1)).toBe(true)
  })
})
