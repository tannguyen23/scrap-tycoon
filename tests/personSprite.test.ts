import type { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { createPersonSprite } from '@ui/scene/focus/parts'
import { createPickerSprite } from '@ui/scene/focus/alley/sprites'
import { createHaulerSprite } from '@ui/scene/focus/depot/sprites'

/** Composed span of a limb at rest — limb nodes are moved via `x` only. */
function span(node: Container): { minX: number; maxX: number; minY: number; maxY: number } {
  const local = node.getLocalBounds()
  return { minX: node.x + local.minX, maxX: node.x + local.maxX, minY: local.minY, maxY: local.maxY }
}

describe('person sprite composition', () => {
  const rest = createPersonSprite(0, 'straw')

  it('keeps both legs inside the torso footprint with the feet on the ground', () => {
    for (const leg of [rest.legsL, rest.legsR]) {
      const box = span(leg)
      expect(box.minX).toBeGreaterThanOrEqual(-5)
      expect(box.maxX).toBeLessThanOrEqual(6)
      expect(Math.abs(box.maxY)).toBeLessThanOrEqual(0.01)
    }
  })

  it('attaches both arms to the torso instead of hovering beside it', () => {
    const armsL = span(rest.armsL)
    const armsR = span(rest.armsR)
    // The torso spans [-5.5, 5.5]; each arm must reach it from the outside.
    expect(armsL.maxX).toBeGreaterThanOrEqual(-6.5)
    expect(armsL.minX).toBeGreaterThanOrEqual(-9)
    expect(armsR.minX).toBeLessThanOrEqual(6.5)
    expect(armsR.maxX).toBeLessThanOrEqual(9)
    expect(armsL.minY).toBeGreaterThanOrEqual(-16)
    expect(armsL.minY).toBeLessThanOrEqual(-14)
    expect(armsL.maxY).toBeGreaterThanOrEqual(-7)
    expect(armsL.maxY).toBeLessThanOrEqual(-5)
  })

  it('reads as one upright figure: hat over the head, shadow under the feet', () => {
    const box = rest.container.getBounds()
    expect(box.minX).toBeGreaterThanOrEqual(-8.5)
    expect(box.maxX).toBeLessThanOrEqual(10)
    expect(box.minY).toBeLessThanOrEqual(-27)
    expect(box.maxY).toBeLessThanOrEqual(6)
  })

  it('starts with the carried props hidden and the back bag behind the body', () => {
    const picker = createPickerSprite(1)
    const hauler = createHaulerSprite(1)
    expect(picker.bag.visible).toBe(false)
    expect(hauler.sack.visible).toBe(false)
    expect(picker.container.getChildIndex(picker.bag)).toBeLessThan(
      picker.container.getChildIndex(picker.body),
    )
  })
})
