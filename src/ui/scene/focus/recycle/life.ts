import { Container, Graphics } from 'pixi.js'
import { CALM_WIND, type Wind } from '../../weather'
import type { Spot } from '../types'

export interface ForgeLife {
  container: Container
  update(dt: number, elapsed: number, wind?: Wind): void
}

interface Puff {
  node: Graphics
  vx: number
  vy: number
  life: number
  maxLife: number
}

/** Khói ống khói + tro than của xưởng: ít, thưa, theo gió. */
export function createForgeLife(stack: Spot): ForgeLife {
  const container = new Container()
  const puffs: Puff[] = []
  let smokeTimer = 0.8

  const update = (dt: number, elapsed: number, wind: Wind = CALM_WIND): void => {
    smokeTimer -= dt
    if (smokeTimer <= 0) {
      smokeTimer = 1.15 + (elapsed % 1) * 0.3
      const puff = new Graphics().rect(0, 0, 3, 3).fill({ color: 0x9aa0ab, alpha: 0.45 })
      puff.position.set(stack.x, stack.y)
      puffs.push({ node: puff, vx: -2 + wind.x * 16, vy: -12, life: 0, maxLife: 1.5 })
      container.addChild(puff)
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const puff = puffs[i]
      if (!puff) continue
      puff.life += dt
      puff.node.x += puff.vx * dt
      puff.node.y += puff.vy * dt
      const progress = puff.life / puff.maxLife
      if (progress >= 1) {
        container.removeChild(puff.node)
        puff.node.destroy()
        puffs.splice(i, 1)
      } else {
        puff.node.alpha = 0.45 * (1 - progress)
      }
    }
  }

  return { container, update }
}
