import { describe, expect, it } from 'vitest'
import { attachHeldItem, createPlasticBag, createPokingStick, equipItems } from '@ui/scene/focus/heldItems'
import { createPersonSprite } from '@ui/scene/focus/parts'
import { POKE_ITEMS } from '@ui/scene/focus/poses'

describe('held items', () => {
  it('attaches to the chosen hand and follows its swing', () => {
    const sprite = createPersonSprite(0, 'straw')
    const stick = createPokingStick()
    attachHeldItem(sprite, stick, 'right')
    expect(sprite.armsR.children.includes(stick.container)).toBe(true)
    expect(sprite.armsL.children.includes(stick.container)).toBe(false)

    const bag = createPlasticBag()
    attachHeldItem(sprite, bag, 'left')
    expect(sprite.armsL.children.includes(bag.container)).toBe(true)

    const before = stick.container.getBounds().minX
    sprite.armsR.x += 2
    const after = stick.container.getBounds().minX
    expect(after - before).toBeCloseTo(2)
  })

  it('swells the plastic bag as cans fill it', () => {
    const bag = createPlasticBag()
    bag.setFill(0)
    const empty = bag.container.getBounds().height
    bag.setFill(1)
    const full = bag.container.getBounds().height
    expect(full).toBeGreaterThan(empty)
    expect(Number.isFinite(full)).toBe(true)
  })

  it('keeps the stick without a fill (no-op instead of throwing)', () => {
    const stick = createPokingStick()
    expect(() => stick.setFill(1)).not.toThrow()
  })

  it('dresses any body with the poke kit, so characters share actions', () => {
    for (const hat of ['straw', 'cap', 'none'] as const) {
      const body = createPersonSprite(0, hat)
      const gear = equipItems(body, POKE_ITEMS)
      expect(body.armsL.children.includes(gear.bag.container)).toBe(true)
      expect(body.armsR.children.includes(gear.stick.container)).toBe(true)
    }
  })
})
