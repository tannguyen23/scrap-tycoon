import type { ObservableStore } from '@core/store'
import { stockRatio, zoneStockItem, zoneTiers } from '@domain/selectors'
import type { GameContent, GameState, WorkerAction, ZoneId } from '@domain/types'
import type { LocaleStore } from '@i18n/locale'
import { t, type Locale } from '@i18n/types'
import { Application, Container, Graphics, TextureSource } from 'pixi.js'
import { createAmbience } from '@scenery/core/ambience'
import { createDetailLayer } from '@scenery/core/details'
import { createCouriers, courierLegsFor } from './couriers'
import { detailSceneFor } from './focus'
import type { DetailScene } from './focus/types'
import { createLighting } from '@scenery/core/lighting'
import { SCRAP_SCENERY } from '@scenery/packs/scrapYard/pack'
import { TilePainter } from '@ground/core/painter'
import { SCRAP_YARD_PACK } from '@ground/packs/scrapYard/pack'
import { CALM_WIND, createWeather } from './weather'
import { paintWorldGrounds } from '@ground/packs/scrapYard/worldGrounds'
import {
  CANVAS_SCALE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
  type ZoneRect,
} from './zoneLayout'

/**
 * Zoom ladder (camera scale on top of CANVAS_SCALE). Each step reveals a finer
 * art tier: 1× base zone art, 2× micro props (0.5px design grid), 4× nano
 * specks (0.25px). All steps are integers so every tier stays pixel-crisp.
 */
export const ZOOM_LEVELS = [1, 2, 4] as const
const LOD_THRESHOLDS = [1.5, 3] as const

const CENTER_X = VIEW_WIDTH / 2
const CENTER_Y = VIEW_HEIGHT / 2

export interface SceneHandle {
  destroy(): void
  setZoomLevel(level: number): void
  /** Smoothly move the camera to a zone (HUD card click). Zooms to level 2 first when fully out. */
  panTo(zoneId: ZoneId): void
  /** Outline a zone on the map (HUD hover). */
  setHighlight(zoneId: ZoneId | null): void
}

export interface SceneOptions {
  /** Fired when a user gesture (wheel) changes the zoom level. */
  onZoomLevelChange?: (level: number) => void
  /** Live locale for scene text (popups). Missing in dev tools — defaults to Vietnamese. */
  localeStore?: LocaleStore
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Keeps the camera centre inside the world for the given zoom. */
function clampCenter(cx: number, cy: number, scale: number): { x: number; y: number } {
  const halfW = WORLD_WIDTH / (2 * scale)
  const halfH = WORLD_HEIGHT / (2 * scale)
  return {
    x: clamp(cx, halfW, WORLD_WIDTH - halfW),
    y: clamp(cy, halfH, WORLD_HEIGHT - halfH),
  }
}

function intersects(view: ZoneRect, rect: ZoneRect): boolean {
  return (
    view.x < rect.x + rect.width &&
    view.x + view.width > rect.x &&
    view.y < rect.y + rect.height &&
    view.y + view.height > rect.y
  )
}

/**
 * Top-down-tilted scrap-yard map. The world is authored in design pixels
 * (480×270) and rendered at CANVAS_SCALE into a 960×540 canvas, so the zone
 * detail scenes stay dense while the yard has room to grow. The camera is fully
 * manual: wheel/buttons step the 1×/2×/4× LOD ladder and pointer drag pans.
 */
export async function mountScene(
  host: HTMLElement,
  store: ObservableStore<GameState>,
  content: GameContent,
  options: SceneOptions = {},
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

  // Generated tile textures must sample nearest to keep pixel edges crisp.
  TextureSource.defaultOptions.scaleMode = 'nearest'

  const world = new Container()
  app.stage.addChild(world)

  // ---- grounds painted from the generated tile set -------------------------
  const painter = new TilePainter(app.renderer, SCRAP_YARD_PACK)
  const groundLayer = new Container()
  const decorArt = new Graphics()
  paintWorldGrounds(painter, groundLayer, decorArt)

  const detailLayer = new Container()
  const couriers = createCouriers(courierLegsFor(content))
  const microLayer = createDetailLayer(SCRAP_SCENERY.microProps, SCRAP_SCENERY.drawMicro)
  microLayer.visible = false
  const nanoLayer = createDetailLayer(SCRAP_SCENERY.nanoProps, SCRAP_SCENERY.drawNano)
  nanoLayer.visible = false
  const ambience = createAmbience(SCRAP_SCENERY.ambience)
  const lighting = createLighting({ width: WORLD_WIDTH, height: WORLD_HEIGHT }, SCRAP_SCENERY.lights)
  const weather = content.weather ? createWeather({ profile: content.weather }) : null
  const outline = new Graphics()
  // Couriers walk the connectors between zones — they sit right above the zone
  // scenes and shade/tint with the weather + lighting layers like every actor.
  world.addChild(groundLayer, decorArt, detailLayer, couriers.root, microLayer, nanoLayer, ambience.container)
  if (weather) {
    // Mây/mưa đứng TRƯỚC grade ngày-đêm nên tự ăn tint; chớp sét đứng SAU grade
    // để không bị multiply làm tối.
    world.addChild(weather.container)
  }
  world.addChild(lighting.container)
  if (weather) world.addChild(weather.flash)
  world.addChild(outline)

  // Zone detail scenes are the base art now — always visible at every zoom.
  const details = new Map<ZoneId, DetailScene>()
  for (const zoneId of Object.keys(content.zones)) {
    const layout = ZONE_LAYOUTS[zoneId]
    const factory = detailSceneFor(zoneId)
    if (!layout || !factory) continue
    const detail = factory(layout.rect, painter)
    details.set(zoneId, detail)
    detailLayer.addChild(detail.root)
  }

  // ---- camera (world/design units) -----------------------------------------
  let zoomIndex = 0
  let cssScale = 1
  const cam = { scale: 1, cx: WORLD_WIDTH / 2, cy: WORLD_HEIGHT / 2 }
  const camTarget = { scale: 1, cx: cam.cx, cy: cam.cy }

  const applyCamera = (): void => {
    const total = cam.scale * CANVAS_SCALE
    world.scale.set(total)
    world.position.set(
      Math.round(CENTER_X - cam.cx * total),
      Math.round(CENTER_Y - cam.cy * total),
    )
  }
  applyCamera()

  const localeStore = options.localeStore
  let locale: Locale = localeStore?.get() ?? 'vi'

  const sync = (): void => {
    const state = store.getSnapshot()
    const zoneCounts = new Map<ZoneId, number>()
    const zoneItems = new Map<ZoneId, string>()
    const zoneActions = new Map<ZoneId, Partial<Record<WorkerAction, number>>>()
    const workerCounts = new Map<string, number>()

    for (const branch of Object.values(content.branches)) {
      const branchState = state.branches[branch.id]
      if (!branchState) continue
      for (const worker of branch.workers) {
        const count = branchState.workers[worker.id] ?? 0
        if (count <= 0) continue
        workerCounts.set(worker.id, count)
        const zone = worker.visual.zone
        zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + count)
        const action = worker.visual.action
        const byAction = zoneActions.get(zone)
        if (byAction) byAction[action] = (byAction[action] ?? 0) + count
        else zoneActions.set(zone, { [action]: count })
        if (!zoneItems.has(zone)) {
          zoneItems.set(zone, worker.output.item)
        }
      }
    }

    const totalEarned = state.stats.totalEarned
    const earnedLog10 = totalEarned.gte(10) ? totalEarned.log10().toNumber() : 0
    const tiers = zoneTiers(content, state)
    couriers.setCounts({ workers: workerCounts, tiers })

    // Popup wording: the item each zone produces + the currency, both localized.
    const moneyName = content.items[content.currencyItemId]?.name
    const moneyLabel = moneyName ? t(moneyName, locale) : content.currencyItemId
    const itemLabel = (itemId: string | undefined): string => {
      const name = itemId ? content.items[itemId]?.name : undefined
      return name ? t(name, locale) : moneyLabel
    }

    for (const [zoneId, detail] of details) {
      const stockItem = zoneStockItem(content, zoneId)
      const ratio = stockItem ? stockRatio(state, content, stockItem) : null
      detail.setState({
        workers: zoneCounts.get(zoneId) ?? 0,
        actions: zoneActions.get(zoneId) ?? {},
        earnedLog10,
        tier: tiers.get(zoneId) ?? 0,
        labels: { produced: itemLabel(zoneItems.get(zoneId)), money: moneyLabel },
        stock01: ratio ?? -1,
      })
    }
  }

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

  const panTo = (zoneId: ZoneId): void => {
    const layout = ZONE_LAYOUTS[zoneId]
    if (!layout) return
    if (zoomIndex === 0) setZoomIndex(1, true)
    const centered = clampCenter(
      layout.rect.x + layout.rect.width / 2,
      layout.rect.y + layout.rect.height / 2,
      camTarget.scale,
    )
    camTarget.cx = centered.x
    camTarget.cy = centered.y
  }

  const setHighlight = (zoneId: ZoneId | null): void => {
    outline.clear()
    if (!zoneId) return
    const layout = ZONE_LAYOUTS[zoneId]
    if (!layout) return
    const { rect, style } = layout
    outline
      .rect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4)
      .stroke({ width: 2, color: style.color, alpha: 0.9 })
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
    const canvasX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const canvasY = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT
    const totalOld = cam.scale * CANVAS_SCALE
    const worldX = cam.cx + (canvasX - CENTER_X) / totalOld
    const worldY = cam.cy + (canvasY - CENTER_Y) / totalOld

    zoomIndex = next
    const scale = ZOOM_LEVELS[zoomIndex] ?? 1
    camTarget.scale = scale
    const totalNew = scale * CANVAS_SCALE
    const centered = clampCenter(
      worldX - (canvasX - CENTER_X) / totalNew,
      worldY - (canvasY - CENTER_Y) / totalNew,
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

  const unsubscribe = store.subscribe(sync)
  // New popups follow the language switch; ones already flying keep their text.
  const unsubscribeLocale = localeStore
    ? localeStore.subscribe(() => {
        locale = localeStore.get()
        sync()
      })
    : undefined
  sync()

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
    if (weather) {
      weather.update(dt, store.getSnapshot().stats.playTimeS)
      wind = weather.wind()
      for (const detail of details.values()) detail.setAmbient?.(wind)
    }

    // Update only what is actually on screen.
    const viewWidth = WORLD_WIDTH / cam.scale
    const viewHeight = WORLD_HEIGHT / cam.scale
    const view: ZoneRect = {
      x: cam.cx - viewWidth / 2,
      y: cam.cy - viewHeight / 2,
      width: viewWidth,
      height: viewHeight,
    }
    for (const [zoneId, detail] of details) {
      const layout = ZONE_LAYOUTS[zoneId]
      if (!layout || !intersects(view, layout.rect)) continue
      detail.update(dt, elapsed)
    }
    couriers.update(dt, view)
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
    cssScale = Math.max(0.4, Math.min(availW / VIEW_WIDTH, availH / VIEW_HEIGHT))
    canvas.style.imageRendering = cssScale < 0.98 ? 'auto' : 'pixelated'
    canvas.style.width = `${VIEW_WIDTH * cssScale}px`
    canvas.style.height = `${VIEW_HEIGHT * cssScale}px`
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
      unsubscribe()
      unsubscribeLocale?.()
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
  }
}
