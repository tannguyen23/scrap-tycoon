import { Container, Graphics } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import type { TilePainter } from '@ground/core/painter'
import { sortByDepth } from '@ui/scene/focus/parts'
import { createRecycleDetail } from '@ui/scene/focus/recycle/scene'

/** Drawing through a stub keeps the scene test headless (same trick as warehouseStacks). */
const painter = {
  paintBlob: () => {},
  paintMasked: () => {},
  paintPath: () => {},
  scatter: () => {},
} as unknown as TilePainter

describe('depth sorting', () => {
  it('orders a layer back to front by ground line', () => {
    const layer = new Container()
    const near = new Graphics()
    near.y = 90
    near.label = 'near'
    const far = new Graphics()
    far.y = 10
    far.label = 'far'
    const mid = new Graphics()
    mid.y = 40
    mid.label = 'mid'
    // Added out of order on purpose: depth must win over insertion order.
    layer.addChild(near, far, mid)

    sortByDepth(layer)
    expect(layer.children.map((child) => child.label)).toEqual(['far', 'mid', 'near'])
  })

  it('keeps the zone actor layer sorted every frame, so actors occlude by y', () => {
    const scene = createRecycleDetail({ x: 608, y: 8, width: 264, height: 176 }, painter)
    scene.setState({
      workers: 4,
      actions: {},
      earnedLog10: 5,
      tier: 0,
      labels: { produced: 'Phôi tái chế', money: 'Tiền', hold: 'GIỮ' },
      stock01: 0.4,
    })
    const actors = scene.root.children.find((child) => child.label === 'actors')
    if (!(actors instanceof Container)) throw new Error('scene has no actors layer')

    for (let frame = 0; frame < 60 * 5; frame++) {
      scene.update(1 / 60, frame / 60)
      const ys = actors.children.map((child) => child.y)
      for (let i = 1; i < ys.length; i++) {
        const previous = ys[i - 1] ?? 0
        const current = ys[i] ?? 0
        expect(current, `frame ${frame}: actor ${i} is drawn behind one further south`).toBeGreaterThanOrEqual(
          previous,
        )
      }
    }

    expect(actors.children.length).toBeGreaterThanOrEqual(2)
  })
})
