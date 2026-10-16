import { describe, expect, it } from 'vitest'
import { createPorter } from '@ui/scene/focus/alley/actors'
import { ALLEY_DROPOFF, ALLEY_HAUL_OUT, createAlleyDetail } from '@ui/scene/focus/alley/scene'
import { createPorterSprite } from '@ui/scene/focus/alley/sprites'
import { Particles } from '@ui/scene/focus/parts'
import { ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import type { Spot } from '@scene/core/types'
import type { TilePainter } from '@ground/core/painter'

const ALLEY = ZONE_LAYOUTS['alley']
if (!ALLEY) throw new Error('fixture is missing the alley layout')

// The anchors the scene actually uses, not a second copy of them.
const PILE: Spot = ALLEY_DROPOFF
const HAUL_OUT: Spot = ALLEY_HAUL_OUT

describe('alley porter actor', () => {
  it('starts with the hauled sack hidden', () => {
    expect(createPorterSprite(1).sack.visible).toBe(false)
  })

  it('lifts a sack at the pile and drops it at the east mouth, round after round', () => {
    const actor = createPorter(0, PILE, HAUL_OUT)
    const particles = new Particles()

    let carries = 0
    let carrying = false
    let liftedAtPile = false
    let droppedAtMouth = false
    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (let frame = 0; frame < 60 * 90; frame++) {
      actor.update(1 / 60, particles)
      particles.update(1 / 60)
      const { x, y } = actor.sprite.container
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      const carryingNow = actor.sprite.sack.visible
      if (carryingNow && !carrying) {
        carries += 1
        // The sack only ever appears while he stands at the gathered pile.
        if (Math.hypot(x - PILE.x, y - PILE.y) < 24) liftedAtPile = true
      }
      if (!carryingNow && carrying) {
        // ...and disappears at the east gate, i.e. on the forge road.
        if (Math.hypot(x - HAUL_OUT.x, y - HAUL_OUT.y) < 30) droppedAtMouth = true
      }
      carrying = carryingNow
    }

    expect(carries).toBeGreaterThanOrEqual(2)
    expect(liftedAtPile).toBe(true)
    expect(droppedAtMouth).toBe(true)
    // The route stays inside the working plot and out through the east gate: never
    // past the gate onto the forge road.
    expect(minX).toBeGreaterThanOrEqual(230)
    expect(maxX).toBeLessThanOrEqual(420)
    expect(minY).toBeGreaterThanOrEqual(50)
    expect(maxY).toBeLessThanOrEqual(290)
  })
})

describe('alley detail scene', () => {
  it('crews pickers and porters off the action breakdown, through stock changes', () => {
    const painter = {
      paintBlob: () => {},
      scatter: () => {},
    } as unknown as TilePainter
    const scene = createAlleyDetail({ ...ALLEY.rect, x: 48, y: 48 }, painter)
    const labels = { produced: 'Sắt vụn', money: 'Tiền', hold: 'GIỮ' }

    scene.setState({ workers: 4, actions: { pick: 3, haul: 1 }, earnedLog10: 4, tier: 0, labels, stock01: 0.5 })
    for (let i = 0; i < 60 * 15; i++) scene.update(1 / 60, i / 60)

    // An empty pile (all pickers idle, no porters) then a full one — both safe.
    scene.setState({ workers: 3, actions: { pick: 3 }, earnedLog10: 4, tier: 0, labels, stock01: 0 })
    scene.update(1 / 60, 0)
    scene.setState({ workers: 3, actions: { pick: 3 }, earnedLog10: 4, tier: 0, labels, stock01: 1 })
    scene.update(1 / 60, 0)

    expect(scene.root.children.length).toBeGreaterThan(5)
  })
})
