import { isSprinting, moveVector } from '@ui/scene/player/keys'
import { describe, expect, it } from 'vitest'

describe('movement keys', () => {
  it('reads WASD and the arrow keys into one direction', () => {
    expect(moveVector(new Set(['w']))).toEqual({ x: 0, y: -1 })
    expect(moveVector(new Set(['arrowright']))).toEqual({ x: 1, y: 0 })
    // Both keys of the same direction still mean one step, not two.
    expect(moveVector(new Set(['s', 'arrowdown']))).toEqual({ x: 0, y: 1 })
    expect(moveVector(new Set())).toEqual({ x: 0, y: 0 })
  })

  it('normalises diagonals so a slant is not faster', () => {
    const diagonal = moveVector(new Set(['w', 'd']))
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 6)
  })

  it('sprints only with shift', () => {
    expect(isSprinting(new Set(['shift', 'w']))).toBe(true)
    expect(isSprinting(new Set(['w']))).toBe(false)
  })
})
