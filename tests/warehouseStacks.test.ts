import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { createDepotDetail } from '@ui/scene/focus/depot/scene'
import { drawPalletStack } from '@ui/scene/focus/depot/sprites'
import { createGateDetail } from '@ui/scene/focus/gate/scene'
import { drawCrateStack } from '@ui/scene/focus/gate/sprites'
import { createRouteDetail } from '@ui/scene/focus/route/scene'
import { drawBilletStack } from '@ui/scene/focus/route/sprites'
import type { DetailScene } from '@ui/scene/focus/types'
import type { TilePainter } from '@ground/core/painter'

const painter = {
  paintBlob: () => {},
  paintMasked: () => {},
  paintPath: () => {},
  scatter: () => {},
} as unknown as TilePainter

const DRAWERS = [drawBilletStack, drawPalletStack, drawCrateStack]

/** Depth-first search for a labelled container (warehouse stacks live in a depth layer). */
function findLabelled(container: Container, label: string): Container | null {
  for (const child of container.children) {
    if (!(child instanceof Container)) continue
    if (child.label === label) return child
    const nested = findLabelled(child, label)
    if (nested) return nested
  }
  return null
}

describe('warehouse stacks', () => {
  it('draw nothing at an empty bin and pile upward as it fills', () => {
    for (const draw of DRAWERS) {
      const empty = new Container()
      draw(empty, 0, 0, 0)
      expect(empty.children.length).toBe(0)

      const low = new Container()
      draw(low, 0, 0, 2)
      const full = new Container()
      draw(full, 0, 0, 8)

      expect(low.children.length).toBe(2)
      expect(full.children.length).toBe(8)
      const lowTop = Math.min(...low.children.map((child) => child.position.y))
      const fullTop = Math.min(...full.children.map((child) => child.position.y))
      expect(fullTop).toBeLessThan(lowTop)
    }
  })

  it('redraw idempotently at the same level', () => {
    const stack = new Container()
    drawBilletStack(stack, 0, 0, 3)
    drawBilletStack(stack, 0, 0, 3)
    expect(stack.children.length).toBe(3)
    drawBilletStack(stack, 0, 0, 4)
    expect(stack.children.length).toBe(4)
  })
})

describe('zone warehouse readouts', () => {
  it('rebuild route/depot/gate stacks from the real fill level', () => {
    const route = createRouteDetail({ x: 0, y: 380, width: 1280, height: 64 }, painter)
    const depot = createDepotDetail({ x: 80, y: 560, width: 264, height: 88 }, painter)
    const gate = createGateDetail({ x: 860, y: 548, width: 256, height: 92 }, painter)
    const base = {
      workers: 2,
      actions: {},
      earnedLog10: 5,
      tier: 0,
      labels: { produced: 'Phôi tái chế', money: 'Tiền' },
    }

    // Kho nằm trong LỚP DEPTH của khu (cùng chỗ actor để che nhau theo y), nên tìm
    // theo cây chứ không chỉ children của root.
    const warehouseOf = (scene: DetailScene): Container => {
      const found = findLabelled(scene.root, 'warehouse')
      if (!found) throw new Error('scene has no warehouse container')
      return found
    }

    for (const scene of [route, depot, gate]) {
      scene.setState({ ...base, stock01: 0 })
      scene.update(1 / 60, 1)
      expect(warehouseOf(scene).children.length).toBe(0)

      scene.setState({ ...base, stock01: 0.6 })
      scene.update(1 / 60, 2)
      const half = warehouseOf(scene).children.length
      expect(half).toBeGreaterThan(0)

      // A full bin builds more goods and blinks its red marker — still safe.
      scene.setState({ ...base, stock01: 1 })
      scene.update(1 / 60, 3)
      expect(warehouseOf(scene).children.length).toBeGreaterThan(half)

      scene.setState({ ...base, workers: 0, stock01: -1 })
      scene.update(1 / 60, 4)
      expect(warehouseOf(scene).children.length).toBe(0)
    }
  })
})
