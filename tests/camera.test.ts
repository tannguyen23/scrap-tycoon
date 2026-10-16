import { clampCameraCenter } from '@scene/core/scene'
import { describe, expect, it } from 'vitest'

const WORLD = { width: 10240, height: 5760 }
const VIEW = { width: 1280, height: 720 }

describe('camera clamp', () => {
  it('lets a big world pan to its edges at every zoom step', () => {
    // 1× used to be pinned dead centre (the clamp was sized off the world, not the
    // viewport), so dragging did nothing at all.
    expect(clampCameraCenter(WORLD, VIEW, 1, -9999, -9999)).toEqual({ x: 640, y: 360 })
    expect(clampCameraCenter(WORLD, VIEW, 1, 9999, 9999)).toEqual({ x: 9600, y: 5400 })
    expect(clampCameraCenter(WORLD, VIEW, 1, 3000, 2000)).toEqual({ x: 3000, y: 2000 })

    // 2× and 4× — a tighter view, and the far edge of the world is still reachable.
    expect(clampCameraCenter(WORLD, VIEW, 2, 0, 0)).toEqual({ x: 320, y: 180 })
    expect(clampCameraCenter(WORLD, VIEW, 2, 9999, 9999)).toEqual({ x: 9920, y: 5580 })
    expect(clampCameraCenter(WORLD, VIEW, 4, 0, 0)).toEqual({ x: 160, y: 90 })
  })

  it('keeps a world that fits the view centred', () => {
    const small = { width: 1280, height: 720 }
    expect(clampCameraCenter(small, VIEW, 1, 9999, 0)).toEqual({ x: 640, y: 360 })
    const tiny = { width: 640, height: 400 }
    expect(clampCameraCenter(tiny, VIEW, 1, 100, 100)).toEqual({ x: 320, y: 200 })
  })
})
