import { describe, expect, it } from 'vitest'
import { PICK, POKE, WORK_ACTIONS, restPose, walkPose } from '@ui/scene/focus/poses'
import { createPersonSprite } from '@ui/scene/focus/parts'

describe('character poses', () => {
  it('rest pose pins the limbs to the constants the actors use', () => {
    const sprite = createPersonSprite(0, 'straw')
    sprite.legsL.x = 99
    sprite.legsR.x = 99
    sprite.armsL.x = 99
    sprite.armsR.x = 99
    sprite.body.y = -5
    sprite.body.scale.set(1, 0.5)
    sprite.face.visible = false

    restPose(sprite)

    expect(sprite.legsL.x).toBe(-3.8)
    expect(sprite.legsR.x).toBe(0.3)
    expect(sprite.armsL.x).toBe(-7.5)
    expect(sprite.armsR.x).toBe(4.5)
    expect(sprite.body.y).toBe(0)
    expect(sprite.body.scale.y).toBe(1)
    expect(sprite.face.visible).toBe(true)
  })

  it('walk pose swings limbs between the two frames — and can leave the arms to a carry pose', () => {
    const sprite = createPersonSprite(0, 'straw')
    walkPose(sprite, 0)
    const legFirst = sprite.legsL.x
    const armFirst = sprite.armsR.x

    walkPose(sprite, 0.15)
    expect(sprite.legsL.x).not.toBe(legFirst)
    expect(sprite.armsR.x).not.toBe(armFirst)

    // Carrying poses own the arms: the gait must not swing them back.
    sprite.armsL.x = -3.6
    sprite.armsR.x = 0.8
    walkPose(sprite, 0.5, { swingArms: false })
    expect(sprite.armsL.x).toBe(-3.6)
    expect(sprite.armsR.x).toBe(0.8)
  })

  it('every work action keeps the figure inside sane limb bounds', () => {
    const sprite = createPersonSprite(0, 'straw')
    for (const action of WORK_ACTIONS) {
      for (const p of [0, 0.25, 0.5, 0.75, 0.99]) {
        restPose(sprite)
        action.apply(sprite, p)
        for (const value of [sprite.armsL.x, sprite.armsR.x, sprite.legsL.x, sprite.legsR.x, sprite.body.scale.y]) {
          expect(Number.isFinite(value)).toBe(true)
        }
        expect(sprite.armsL.x).toBeGreaterThanOrEqual(-10)
        expect(sprite.armsR.x).toBeLessThanOrEqual(10)
      }
    }
  })

  it('pick crouches the body at the middle of the beat', () => {
    const sprite = createPersonSprite(0, 'straw')
    restPose(sprite)
    PICK.apply(sprite, 0.5)
    expect(sprite.body.scale.y).toBeLessThan(1)
    expect(sprite.armsL.x).toBeCloseTo(-5)
  })

  it('poke starts from rest, thrusts the stick arm forward, then returns', () => {
    const sprite = createPersonSprite(0, 'straw')
    restPose(sprite)
    POKE.apply(sprite, 0)
    expect(sprite.armsR.x).toBeCloseTo(4.5)

    POKE.apply(sprite, 0.5)
    expect(sprite.armsR.x).toBeGreaterThan(4.5)

    POKE.apply(sprite, 0.999)
    expect(sprite.armsR.x).toBeCloseTo(4.5, 1)
  })
})
