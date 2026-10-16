import type { Rect } from '@ground/core/metrics'
import { SCRAP_MAP } from '@ground/packs/scrapYard/worldGrounds'
import { CLEARINGS, WATER_AREAS, WORLD_HEIGHT, WORLD_WIDTH, ZONE_LAYOUTS } from '@ground/packs/scrapYard/worldLayout'
import { UI } from '@i18n/text'
import { useText } from '@ui/hooks'
import { useEffect, useRef, type RefObject } from 'react'

/** Schematic size: the world is 16:9, so the map stays 16:9 too. */
const MAP_W = 240
const MAP_H = Math.round((MAP_W * WORLD_HEIGHT) / WORLD_WIDTH)
const SCALE = MAP_W / WORLD_WIDTH
/** Redraw rate while open — the map is a readout, not a 60fps layer. */
const REDRAW_MS = 160

const COLORS = {
  base: '#3c5432',
  field: 'rgba(127, 106, 74, 0.9)',
  water: '#46759a',
  asphalt: 'rgba(88, 96, 108, 0.95)',
  dirtRoad: 'rgba(150, 124, 86, 0.95)',
  view: '#f0e6cd',
  frame: 'rgba(240, 230, 205, 0.6)',
} as const

export interface MinimapProps {
  /**
   * The live view rect, owned by the scene subscription. Taken as a ref on
   * purpose: the map redraws on its own clock, so panning never re-renders the
   * whole HUD (which is what a `useState` view would do, once per few pixels).
   */
  viewRef: RefObject<Rect | null>
  /** Jump the camera to a world point (click on the map). */
  onJump: (x: number, y: number) => void
}

/**
 * Schematic minimap: drawn from the very layout data the ground pass paints
 * (zones, fields, water, roads) — never baked pixels, so it cannot drift from
 * the map and costs nothing to keep. Click to send the camera there.
 */
export function Minimap({ viewRef, onJump }: MinimapProps) {
  const text = useText()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // The static half: everything that never moves. Drawn once per mount.
    const staticLayer = document.createElement('canvas')
    staticLayer.width = MAP_W
    staticLayer.height = MAP_H
    const base = staticLayer.getContext('2d')
    if (base) {
      base.fillStyle = COLORS.base
      base.fillRect(0, 0, MAP_W, MAP_H)
      const paint = (rect: { x: number; y: number; width: number; height: number }): void => {
        base.fillRect(rect.x * SCALE, rect.y * SCALE, Math.max(1, rect.width * SCALE), Math.max(1, rect.height * SCALE))
      }
      base.fillStyle = COLORS.field
      for (const patch of CLEARINGS) paint(patch.rect)
      base.fillStyle = COLORS.asphalt
      for (const lane of SCRAP_MAP.lanes) {
        if (lane.kind === 'asphalt') paint(lane.rect)
      }
      for (const rect of SCRAP_MAP.connectors.rects) paint(rect)
      base.fillStyle = COLORS.dirtRoad
      for (const lane of SCRAP_MAP.lanes) {
        if (lane.kind !== 'asphalt') paint(lane.rect)
      }
      for (const link of SCRAP_MAP.links) paint(link.rect)
      base.fillStyle = COLORS.water
      for (const area of WATER_AREAS) paint(area.rect)
      for (const layout of Object.values(ZONE_LAYOUTS)) {
        base.fillStyle = layout.style.css
        paint(layout.rect)
      }
      base.strokeStyle = COLORS.frame
      base.strokeRect(0.5, 0.5, MAP_W - 1, MAP_H - 1)
    }

    let last: Rect | null = null
    const draw = (): void => {
      const view = viewRef.current
      if (
        view &&
        last &&
        Math.abs(last.x - view.x) < 1 &&
        Math.abs(last.y - view.y) < 1 &&
        Math.abs(last.width - view.width) < 1 &&
        Math.abs(last.height - view.height) < 1
      ) {
        return
      }
      last = view
      ctx.clearRect(0, 0, MAP_W, MAP_H)
      ctx.drawImage(staticLayer, 0, 0)
      if (view) {
        ctx.strokeStyle = COLORS.view
        ctx.lineWidth = 1
        ctx.strokeRect(
          Math.round(view.x * SCALE) + 0.5,
          Math.round(view.y * SCALE) + 0.5,
          Math.max(2, Math.round(view.width * SCALE)),
          Math.max(2, Math.round(view.height * SCALE)),
        )
      }
    }

    draw()
    const timer = window.setInterval(draw, REDRAW_MS)
    return () => window.clearInterval(timer)
  }, [viewRef])

  return (
    <canvas
      ref={canvasRef}
      className="minimap"
      width={MAP_W}
      height={MAP_H}
      title={text(UI.minimapHint)}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH
        const y = ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT
        onJump(x, y)
      }}
    />
  )
}
