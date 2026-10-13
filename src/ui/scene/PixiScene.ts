import type { ObservableStore } from '@core/store'
import type { GameState } from '@domain/types'
import { Application, Container, Graphics } from 'pixi.js'
import { createWorkerSprite, drawScrapPile } from './textures'

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 180
const GROUND_Y = 140
const MAX_WORKER_SPRITES = 24

export interface SceneHandle {
  destroy(): void
}

interface WorkerSprite {
  container: Container
  phase: number
}

/**
 * Imperative PixiJS scene: it only READS game state (never mutates it) and
 * renders it on a tiny virtual canvas upscaled by whole-number factors, which
 * is what keeps placeholder pixel art crisp.
 */
export async function mountScene(
  host: HTMLElement,
  store: ObservableStore<GameState>,
): Promise<SceneHandle> {
  const app = new Application()
  await app.init({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    background: '#0b0e18',
    antialias: false,
    roundPixels: true,
    resolution: 1,
    autoDensity: false,
  })

  const canvas = app.canvas
  canvas.classList.add('pixel-canvas')
  host.appendChild(canvas)

  const sky = new Graphics().rect(0, 0, VIEW_WIDTH, GROUND_Y).fill(0x141b2e)
  const ground = new Graphics().rect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y).fill(0x2c2620)
  const groundEdge = new Graphics().rect(0, GROUND_Y, VIEW_WIDTH, 2).fill(0x4a3d2c)
  const pile = new Graphics()
  const workersLayer = new Container()
  app.stage.addChild(sky, ground, groundEdge, pile, workersLayer)

  const workers: WorkerSprite[] = []
  let activeWorkers = 0
  let lastPileLevel = -1

  const sync = (): void => {
    const state = store.getSnapshot()

    let totalWorkers = 0
    for (const branchState of Object.values(state.branches)) {
      for (const count of Object.values(branchState.workers)) totalWorkers += count
    }
    activeWorkers = Math.min(totalWorkers, MAX_WORKER_SPRITES)

    while (workers.length < activeWorkers) {
      const container = createWorkerSprite(workers.length)
      workersLayer.addChild(container)
      workers.push({ container, phase: Math.random() * Math.PI * 2 })
    }
    for (let i = 0; i < workers.length; i++) {
      const entry = workers[i]
      if (!entry) continue
      entry.container.visible = i < activeWorkers
      if (i < activeWorkers) {
        entry.container.x = Math.round(xForIndex(i, activeWorkers))
        entry.container.y = GROUND_Y - 8
      }
    }

    const totalEarned = state.stats.totalEarned
    const earnedLog10 = totalEarned.gte(10) ? totalEarned.log10().toNumber() : 0
    const pileLevel = Math.round(earnedLog10 * 1.5)
    if (pileLevel !== lastPileLevel) {
      drawScrapPile(pile, earnedLog10, GROUND_Y)
      lastPileLevel = pileLevel
    }
  }

  const unsubscribe = store.subscribe(sync)
  sync()

  app.ticker.add(() => {
    const t = performance.now() / 1000
    for (let i = 0; i < activeWorkers; i++) {
      const entry = workers[i]
      if (!entry) continue
      entry.container.y = GROUND_Y - 8 + Math.round(Math.sin(t * 3 + entry.phase))
    }
  })

  const fit = (): void => {
    const scale = Math.max(
      1,
      Math.floor(Math.min(host.clientWidth / VIEW_WIDTH, host.clientHeight / VIEW_HEIGHT)),
    )
    canvas.style.width = `${VIEW_WIDTH * scale}px`
    canvas.style.height = `${VIEW_HEIGHT * scale}px`
  }
  const resizeObserver = new ResizeObserver(fit)
  resizeObserver.observe(host)
  fit()

  let destroyed = false
  return {
    destroy: () => {
      if (destroyed) return
      destroyed = true
      unsubscribe()
      resizeObserver.disconnect()
      app.destroy(true, { children: true, texture: true })
    },
  }
}

function xForIndex(index: number, count: number): number {
  if (count <= 1) return VIEW_WIDTH / 2
  const margin = 20
  return margin + (index * (VIEW_WIDTH - margin * 2)) / (count - 1)
}
