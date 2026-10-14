import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { createSmith } from '@ui/scene/focus/recycle/actors'
import { Particles } from '@ui/scene/focus/parts'
import { createPopups } from '@ui/scene/focus/popups'
import type { Spot } from '@ui/scene/focus/types'
import { createRecycleDetail } from '@ui/scene/focus/recycle/scene'
import { TilePainter } from '@ground/core/painter'

/** Popup labels draw through a stub in node — the real one needs a DOM canvas. */
function stubLabel(text: string): Container {
  const node = new Container()
  node.label = text
  return node
}

const spots = {
  pile: { x: 44, y: 100 } as Spot,
  anvil: { x: 198, y: 96 } as Spot,
  stack: { x: 116, y: 148 } as Spot,
  hearth: { x: 150, y: 60 } as Spot,
}

describe('forge smith actor', () => {
  it('hauls a sack in, hammers the anvil with sparks, then stacks a billet', () => {
    const actor = createSmith(0, spots)
    const particles = new Particles()
    const popups = createPopups(stubLabel)
    popups.setLabels({ produced: 'Phôi tái chế', money: 'Tiền' })

    let sawSack = false
    let sawBillet = false
    let sawPopup = false
    let sawSparks = false
    let sawHammerPose = false
    let hitStack = false

    for (let frame = 0; frame < 60 * 60; frame++) {
      actor.update(1 / 60, particles, popups)
      particles.update(1 / 60)
      popups.update(1 / 60)
      if (actor.sprite.sack.visible) sawSack = true
      if (actor.sprite.billet.visible) sawBillet = true
      if (particles.container.children.length > 0) sawSparks = true
      if (actor.sprite.armsR.x < 0) sawHammerPose = true
      if (popups.container.children.some((child) => child.label === '+1 Phôi tái chế')) sawPopup = true
      if (Math.hypot(actor.sprite.container.x - spots.stack.x, actor.sprite.container.y - spots.stack.y) < 8) {
        hitStack = true
      }
    }

    expect(sawSack).toBe(true)
    expect(sawBillet).toBe(true)
    expect(sawHammerPose).toBe(true)
    expect(sawSparks).toBe(true)
    expect(sawPopup).toBe(true)
    expect(hitStack).toBe(true)
    expect(Number.isFinite(actor.sprite.container.x)).toBe(true)
    expect(Number.isFinite(actor.sprite.container.y)).toBe(true)
  })
})

describe('recycle detail scene', () => {
  it('builds a yard that runs through worker and stock changes', () => {
    const painter = {
      paintPath: () => {},
      scatter: () => {},
    } as unknown as TilePainter
    const scene = createRecycleDetail({ x: 608, y: 8, width: 264, height: 176 }, painter)

    scene.setState({
      workers: 2,
      actions: {},
      earnedLog10: 5,
      tier: 0,
      labels: { produced: 'Phôi tái chế', money: 'Tiền' },
      stock01: 0.4,
    })
    for (let i = 0; i < 60 * 20; i++) scene.update(1 / 60, i / 60)

    // Empty stock, then a full bin (blinking marker) — both must be safe.
    const base = {
      actions: {},
      earnedLog10: 5,
      tier: 0,
      labels: { produced: 'Phôi tái chế', money: 'Tiền' },
    }
    scene.setState({ ...base, workers: 0, stock01: 0 })
    scene.update(1 / 60, 0)
    scene.setState({ ...base, workers: 3, stock01: 1 })
    scene.update(1 / 60, 0)

    expect(scene.root.children.length).toBeGreaterThan(5)
  })

  it('is registered for its zone id', async () => {
    const { detailSceneFor } = await import('@ui/scene/focus')
    expect(detailSceneFor('recycle')).toBeDefined()
  })
})
