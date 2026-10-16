import type { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { createPersonSprite } from '@ui/scene/focus/parts'
import { createScavengerSprite } from '@ui/scene/focus/alley/sprites'
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

  it('keeps every gear look inside the same silhouette, feet still grounded', () => {
    // Gear is drawn by the same builder, so a new hat/shirt/pants/shoes must not
    // break the bbox the rest of the game (depth sort, walkable art) relies on.
    const looks = [
      { hat: 'hard' as const },
      { shirt: 'vest' },
      { pants: 'overalls' },
      { shoes: 'boot' },
      { hat: 'hard' as const, shirt: 'vest', pants: 'overalls', shoes: 'boot' },
    ]
    for (const look of looks) {
      const sprite = createPersonSprite(0, 'straw', look)
      const box = sprite.container.getBounds()
      expect(box.minX, JSON.stringify(look)).toBeGreaterThanOrEqual(-8.5)
      expect(box.maxX, JSON.stringify(look)).toBeLessThanOrEqual(10)
      expect(box.minY, JSON.stringify(look)).toBeLessThanOrEqual(-27)
      expect(box.maxY, JSON.stringify(look)).toBeLessThanOrEqual(6)
      // Boots still end on the floor rather than floating.
      expect(Math.abs(span(sprite.legsL).maxY), JSON.stringify(look)).toBeLessThanOrEqual(0.01)
    }
  })

  it('leaves the plain look untouched when no gear is worn', () => {
    const plain = createPersonSprite(0, 'straw', {})
    const bare = createPersonSprite(0, 'straw')
    expect(plain.container.getBounds()).toEqual(bare.container.getBounds())
  })

  it('starts with the hauled sack hidden', () => {
    const hauler = createHaulerSprite(1)
    expect(hauler.sack.visible).toBe(false)
  })

  it('gives the alley scavenger a bag in the left hand and a stick in the right', () => {
    const scavenger = createScavengerSprite(1)
    expect(scavenger.armsL.children.includes(scavenger.bag.container)).toBe(true)
    expect(scavenger.armsR.children.includes(scavenger.poker.container)).toBe(true)
    expect(scavenger.bag.container.visible).toBe(true)
    expect(scavenger.poker.container.visible).toBe(true)
  })
})
