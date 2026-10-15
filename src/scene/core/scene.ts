import type { Rect } from '@ground/core/metrics'
import { TilePainter } from '@ground/core/painter'
import { CALM_WIND } from '@scenery/core/ambience'
import { createAmbience } from '@scenery/core/ambience'
import { createDetailLayer } from '@scenery/core/details'
import { createLighting } from '@scenery/core/lighting'
import { Application, Container, Graphics, TextureSource } from 'pixi.js'
import type { SceneFeed } from './feed'
import type { ScenePack } from './pack'
import type { SceneServices } from './services'
import type { DetailScene } from './types'
import { createWaterLife } from './water'

/**
 * The canvas maps the design grid 1:1; the browser scales it through CSS, so the
 * art is never resampled on screen.
 */
export const CANVAS_SCALE = 1

/**
 * Zoom ladder (camera scale on top of CANVAS_SCALE). Each step reveals a finer
 * art tier: 1× base zone art, 2× micro props (0.5px design grid), 4× nano
 * specks (0.25px). All steps are integers so every tier stays pixel-crisp.
 */
export const ZOOM_LEVELS = [1, 2, 4] as const
const LOD_THRESHOLDS = [1.5, 3] as const

export interface SceneHandle {
  destroy(): void
  setZoomLevel(level: number): void
  /** Smoothly move the camera to a zone (HUD card click). Zooms to level 2 first when fully out. */
  panTo(zoneId: string): void
  /** Outline a zone on the map (HUD hover). */
  setHighlight(zoneId: string | null): void
  /** Push the game's readout in. Called on every store/locale change, never per frame. */
  setFeed(feed: SceneFeed): void
}

export interface SceneOptions {
  /** Fired when a user gesture (wheel) changes the zoom level. */
  onZoomLevelChange?: (level: number) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/**
 * Mounts one project's scene from its pack. The shell owns everything that is
 * the same for every game — camera, input, LOD ladder, layer order, culling, CSS
 * fit — and knows nothing about the game itself: the pack paints the ground,
 * supplies the zone scenes and the cross-zone runs, and the project pushes a
 * `SceneFeed` in whenever its state changes.
 */
export async function mountScene(
  host: HTMLElement,
  pack: ScenePack,
  services: SceneServices,
  options: SceneOptions = {},
): Promise<SceneHandle> {
  const worldWidth = pack.world.width
  const worldHeight = pack.world.height
  const viewWidth = worldWidth * CANVAS_SCALE
  const viewHeight = worldHeight * CANVAS_SCALE
  const centerX = viewWidth / 2
  const centerY = viewHeight / 2

  const app = new Application()
  await app.init({
    width: viewWidth,
    height: viewHeight,
    background: '#0b0e18',
    antialias: false,
    roundPixels: true,
    resolution: 1,
    autoDensity: false,
  })

  const canvas = app.canvas
  canvas.classList.add('pixel-canvas')
  host.appendChild(canvas)

  // Generated tile textures must sample nearest to keep pixel edges crisp.
  TextureSource.defaultOptions.scaleMode = 'nearest'

  const world = new Container()
  app.stage.addChild(world)

  // ---- ground, painted from the pack's tileset ------------------------------
  const painter = new TilePainter(app.renderer, pack.ground.pack)
  const groundLayer = new Container()
  const decorArt = new Graphics()
  pack.ground.paint(painter, groundLayer, decorArt)

  const water = pack.water && pack.water.bodies.length > 0 ? createWaterLife(pack.water, services) : null

  // ---- zone detail scenes, built from the pack's registry -------------------
  const detailLayer = new Container()
  const details = new Map<string, DetailScene>()
  for (const [zoneId, factory] of Object.entries(pack.details)) {
    const zone = pack.zones[zoneId]
    if (!zone) continue
    const detail = factory(zone.rect, painter, services)
    details.set(zoneId, detail)
    detailLayer.addChild(detail.root)
  }

  // ---- the kits' layers -----------------------------------------------------
  const couriers = pack.makeCouriers?.(services) ?? null
  const microLayer = createDetailLayer(pack.scenery.microProps, pack.scenery.drawMicro)
  microLayer.visible = false
  const nanoLayer = createDetailLayer(pack.scenery.nanoProps, pack.scenery.drawNano)
  nanoLayer.visible = false
  const ambience = createAmbience(pack.scenery.ambience)
  const lighting = createLighting({ width: worldWidth, height: worldHeight }, pack.scenery.lights)
  const weather = pack.makeWeather?.(services) ?? null
  const outline = new Graphics()

  // Couriers walk the links between zones — they sit right above the zone scenes
  // and shade/tint with the weather + lighting layers like every actor.
  world.addChild(groundLayer)
  // Water life rides on the ground but under the hand-placed decor, so a tree by
  // a pond still occludes the glints on the water.
  if (water) world.addChild(water.container)
  world.addChild(decorArt, detailLayer)
  if (couriers) world.addChild(couriers.root)
  world.addChild(microLayer, nanoLayer, ambience.container)
  if (weather) {
    // Clouds/rain stand BEFORE the day-night grade so they take its tint; the
    // lightning stands AFTER it so multiply does not darken the flash.
    world.addChild(weather.container)
  }
  world.addChild(lighting.container)
  if (weather) world.addChild(weather.flash)
  world.addChild(outline)

  // ---- camera (world/design units) -----------------------------------------
  let zoomIndex = 0
  let cssScale = 1
  const cam = { scale: 1, cx: worldWidth / 2, cy: worldHeight / 2 }
  const camTarget = { scale: 1, cx: cam.cx, cy: cam.cy }

  /** Keeps the camera centre inside the world for the given zoom. */
  const clampCenter = (cx: number, cy: number, scale: number): { x: number; y: number } => {
    const halfW = worldWidth / (2 * scale)
    const halfH = worldHeight / (2 * scale)
    return { x: clamp(cx, halfW, worldWidth - halfW), y: clamp(cy, halfH, worldHeight - halfH) }
  }

  const applyCamera = (): void => {
    const total = cam.scale * CANVAS_SCALE
    world.scale.set(total)
    world.position.set(Math.round(centerX - cam.cx * total), Math.round(centerY - cam.cy * total))
  }
  applyCamera()

  const setZoomIndex = (index: number, notify: boolean): void => {
    const next = clamp(index, 0, ZOOM_LEVELS.length - 1)
    if (next === zoomIndex) return
    zoomIndex = next
    const scale = ZOOM_LEVELS[zoomIndex] ?? 1
    camTarget.scale = scale
    const centered = clampCenter(camTarget.cx, camTarget.cy, scale)
    camTarget.cx = centered.x
    camTarget.cy = centered.y
    if (notify) options.onZoomLevelChange?.(zoomIndex)
  }

  const panTo = (zoneId: string): void => {
    const zone = pack.zones[zoneId]
    if (!zone) return
    if (zoomIndex === 0) setZoomIndex(1, true)
    const centered = clampCenter(
      zone.rect.x + zone.rect.width / 2,
      zone.rect.y + zone.rect.height / 2,
      camTarget.scale,
    )
    camTarget.cx = centered.x
    camTarget.cy = centered.y
  }

  const setHighlight = (zoneId: string | null): void => {
    outline.clear()
    if (!zoneId) return
    const zone = pack.zones[zoneId]
    if (!zone) return
    const { rect, color } = zone
    outline
      .rect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4)
      .stroke({ width: 2, color, alpha: 0.9 })
  }

  // ---- manual controls: drag to pan, wheel to zoom -------------------------
  let dragging = false
  let dragX = 0
  let dragY = 0

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    dragging = true
    dragX = event.clientX
    dragY = event.clientY
    canvas.classList.add('dragging')
    canvas.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    const dx = event.clientX - dragX
    const dy = event.clientY - dragY
    dragX = event.clientX
    dragY = event.clientY
    const worldPerScreen = 1 / (cssScale * cam.scale * CANVAS_SCALE)
    const centered = clampCenter(
      cam.cx - dx * worldPerScreen,
      cam.cy - dy * worldPerScreen,
      camTarget.scale,
    )
    cam.cx = centered.x
    cam.cy = centered.y
    camTarget.cx = centered.x
    camTarget.cy = centered.y
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (!dragging) return
    dragging = false
    canvas.classList.remove('dragging')
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  }

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const direction = event.deltaY < 0 ? 1 : -1
    const next = clamp(zoomIndex + direction, 0, ZOOM_LEVELS.length - 1)
    if (next === zoomIndex) return

    // Keep the world point under the cursor anchored while the scale changes.
    const rect = canvas.getBoundingClientRect()
    const canvasX = ((event.clientX - rect.left) / rect.width) * viewWidth
    const canvasY = ((event.clientY - rect.top) / rect.height) * viewHeight
    const totalOld = cam.scale * CANVAS_SCALE
    const worldX = cam.cx + (canvasX - centerX) / totalOld
    const worldY = cam.cy + (canvasY - centerY) / totalOld

    zoomIndex = next
    const scale = ZOOM_LEVELS[zoomIndex] ?? 1
    camTarget.scale = scale
    const totalNew = scale * CANVAS_SCALE
    const centered = clampCenter(
      worldX - (canvasX - centerX) / totalNew,
      worldY - (canvasY - centerY) / totalNew,
      scale,
    )
    camTarget.cx = centered.x
    camTarget.cy = centered.y
    options.onZoomLevelChange?.(zoomIndex)
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  let feed: SceneFeed | null = null
  const setFeed = (next: SceneFeed): void => {
    feed = next
    for (const [zoneId, detail] of details) {
      const zone = next.zones[zoneId]
      if (!zone) continue
      detail.setState({ ...zone, earnedLog10: next.earnedLog10 })
    }
    couriers?.setFeed(next)
  }

  let elapsed = 0
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.1)
    elapsed += dt

    const k = 1 - Math.exp(-dt * 9)
    cam.scale += (camTarget.scale - cam.scale) * k
    cam.cx += (camTarget.cx - cam.cx) * k
    cam.cy += (camTarget.cy - cam.cy) * k
    if (
      Math.abs(cam.scale - camTarget.scale) < 0.002 &&
      Math.abs(cam.cx - camTarget.cx) < 0.1 &&
      Math.abs(cam.cy - camTarget.cy) < 0.1
    ) {
      cam.scale = camTarget.scale
      cam.cx = camTarget.cx
      cam.cy = camTarget.cy
    }
    applyCamera()

    microLayer.visible = cam.scale >= LOD_THRESHOLDS[0]
    nanoLayer.visible = cam.scale >= LOD_THRESHOLDS[1]

    let wind = CALM_WIND
    if (weather && feed) {
      weather.update(dt, feed.playTimeS)
      wind = weather.wind()
      for (const detail of details.values()) detail.setAmbient?.(wind)
    }

    // Update only what is actually on screen.
    const viewWidthNow = worldWidth / cam.scale
    const viewHeightNow = worldHeight / cam.scale
    const view: Rect = {
      x: cam.cx - viewWidthNow / 2,
      y: cam.cy - viewHeightNow / 2,
      width: viewWidthNow,
      height: viewHeightNow,
    }
    for (const [zoneId, detail] of details) {
      const zone = pack.zones[zoneId]
      if (!zone || !intersects(view, zone.rect)) continue
      detail.update(dt, elapsed)
    }
    couriers?.update(dt, view)
    water?.update(dt, wind)
    ambience.update(dt, wind)
    lighting.update(dt)
  })

  // The canvas sits inside the paper "map mat" (.scene-frame). Its available
  // space is the layout-sized parent minus both paddings — measuring the frame
  // itself would feed back into its own content size.
  const fit = (): void => {
    const parent = host.parentElement ?? host
    const hostStyle = getComputedStyle(host)
    const parentStyle = getComputedStyle(parent)
    const chromeX =
      parseFloat(hostStyle.paddingLeft) +
      parseFloat(hostStyle.paddingRight) +
      parseFloat(parentStyle.paddingLeft) +
      parseFloat(parentStyle.paddingRight)
    const chromeY =
      parseFloat(hostStyle.paddingTop) +
      parseFloat(hostStyle.paddingBottom) +
      parseFloat(parentStyle.paddingTop) +
      parseFloat(parentStyle.paddingBottom)
    const availW = Math.max(1, parent.clientWidth - chromeX)
    const availH = Math.max(1, parent.clientHeight - chromeY)
    // Fill the frame with fractional scaling so the map always uses the whole
    // window; below 1× let the browser sample smoothly instead of dropping pixels.
    cssScale = Math.max(0.4, Math.min(availW / viewWidth, availH / viewHeight))
    canvas.style.imageRendering = cssScale < 0.98 ? 'auto' : 'pixelated'
    canvas.style.width = `${viewWidth * cssScale}px`
    canvas.style.height = `${viewHeight * cssScale}px`
  }
  const resizeObserver = new ResizeObserver(fit)
  resizeObserver.observe(host.parentElement ?? host)
  fit()

  let destroyed = false
  return {
    destroy: () => {
      if (destroyed) return
      destroyed = true
      weather?.dispose()
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      app.destroy(true, { children: true, texture: true })
    },
    setZoomLevel: (level) => setZoomIndex(level, false),
    panTo,
    setHighlight,
    setFeed,
  }
}
