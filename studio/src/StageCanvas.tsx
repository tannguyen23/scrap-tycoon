import { Application, TextureSource } from 'pixi.js'
import { useEffect, useRef } from 'react'
import type { StageBuilder, StageScene } from './types'

interface Props {
  build: StageBuilder
  onScene?: (scene: StageScene) => void
}

/**
 * Mounts one pixi stage for a preview builder: the canvas is sized to the scene
 * (1:1, so the studio never resamples pixels) and torn down with the component.
 */
export function StageCanvas({ build, onScene }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const onSceneRef = useRef(onScene)

  useEffect(() => {
    onSceneRef.current = onScene
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let scene: StageScene | null = null
    let elapsed = 0
    const app = new Application()

    void app
      .init({ width: 1, height: 1, backgroundAlpha: 0, antialias: false, autoDensity: false, resolution: 1 })
      .then(() => {
        if (disposed) {
          app.destroy(true, { children: true, texture: true })
          return
        }
        TextureSource.defaultOptions.scaleMode = 'nearest'
        scene = build(app)
        app.renderer.resize(scene.width, scene.height)
        host.style.width = `${scene.width}px`
        host.style.height = `${scene.height}px`
        const canvas = app.canvas
        canvas.classList.add('pixel-canvas')
        host.appendChild(canvas)
        app.stage.addChild(scene.root)
        onSceneRef.current?.(scene)
        app.ticker.add((ticker) => {
          const dt = Math.min(ticker.deltaMS / 1000, 0.1)
          elapsed += dt
          scene?.update?.(dt, elapsed)
        })
      })

    return () => {
      disposed = true
      scene = null
      try {
        app.destroy(true, { children: true, texture: true })
      } catch {
        // the app never finished initialising — nothing to tear down
      }
    }
  }, [build])

  return <div ref={hostRef} className="stage-canvas" />
}