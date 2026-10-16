import { Application, Container, Graphics } from 'pixi.js'
import type { WeatherKindDef, WeatherProfile, ZoneId } from '@domain/types'
import { TilePainter } from '@ground/core/painter'
import { SCRAP_YARD_PACK } from '@ground/packs/scrapYard/pack'
import { paintWorldGrounds } from '@ground/packs/scrapYard/worldGrounds'
import { createAmbience } from '@scenery/core/ambience'
import { createLighting } from '@scenery/core/lighting'
import { SCRAP_SCENERY } from '@scenery/packs/scrapYard/pack'
import type { StageBuilder, StageCell, StageScene } from '@studio/types'
import { COURIER_RUNS, createCouriers, type CourierLeg } from '@ui/scene/couriers'
import { DECOR_SPECIMENS } from '@ground/packs/scrapYard/decorItems'
import { detailSceneFor } from '@ui/scene/focus'
import { createHaulerSprite } from '@ui/scene/focus/depot/sprites'
import { createTruckFrontSprite, createTruckSprite } from '@ui/scene/focus/gate/sprites'
import { equipItems, type HeldItem } from '@ui/scene/focus/heldItems'
import {
  Particles,
  createPersonSprite,
  createSack,
  createScrapBit,
  createSpokeWheel,
  type PersonSprite,
  type SpokeWheel,
} from '@ui/scene/focus/parts'
import { POKE, WORK_ACTIONS, restPose, walkPose, type WorkAction } from '@ui/scene/focus/poses'
import { createCartSprite, createPickupSprite, createRouteTruckSprite } from '@ui/scene/focus/route/sprites'
import type { DetailScene } from '@scene/core/types'
import { DEFAULT_SERVICES } from '@scene/core/services'
import { createWeather } from '@ui/scene/weather'
import {
  CLEARINGS,
  CONNECTORS,
  WATER_AREAS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_LAYOUTS,
} from '@ground/packs/scrapYard/worldLayout'

/** Popup wording for studio previews — the real labels come localized from content. */
const STUDIO_LABELS = { produced: 'Sắt vụn', money: 'Tiền' }

/**
 * The studio previews one district, not the whole world: the ground is painted
 * with a window (the exact mechanism the scene chunks by), so a preview stays a
 * few screens of real art instead of allocating a 58-million-pixel canvas.
 */
const CORE_WINDOW = { x: 3712, y: 1888, width: 3008, height: 1408 }

/** The map schematic is drawn to scale — the world is 16:9, so it fits one screen. */
const LAYOUT_SCALE = 0.1

const DECOR_SCALE = 2

/**
 * Decor catalog as a vertical list: one specimen per row, label on the left, art
 * on the right, grouped by family. Reads like an asset list instead of a wall of
 * sprites.
 */
export function buildDecor(): StageScene {
  const root = new Container()
  const cells: StageCell[] = []
  const rowH = 92
  const artX = 250
  let row = 0
  let group = ''

  for (const specimen of DECOR_SPECIMENS) {
    const baseY = row * rowH + 74
    if (specimen.group !== group) {
      group = specimen.group
      cells.push({ label: group, x: 12, y: row * rowH + 4, width: 300, height: 14, kind: 'caption' })
    }
    const art = new Graphics()
    specimen.draw(art, 0, 0)
    art.scale.set(DECOR_SCALE)
    art.position.set(artX, baseY)
    root.addChild(art)
    cells.push({
      label: `${specimen.label} · ${specimen.width}×${specimen.height}`,
      x: 12,
      y: row * rowH + 30,
      width: 220,
      height: 14,
      kind: 'label',
    })
    row++
  }

  return { root, width: 380, height: row * rowH + 12, cells }
}

export interface CharacterClip {
  id: string
  label: string
  /** Work clip when set — a plain gait (đi bộ) when omitted. */
  action?: WorkAction
}

/** Every clip the sheet can play — the walk gait plus all registered work actions. */
export const CHARACTER_CLIPS: readonly CharacterClip[] = [
  { id: 'walk', label: 'đi bộ' },
  ...WORK_ACTIONS.map((action) => ({ id: action.id, label: action.label, action })),
]

export interface CharacterSpec {
  id: string
  prefix: string
  make: (variant: number) => PersonSprite
}

/**
 * Bodies the sheet can dress. They carry no gear of their own — the kit comes
 * with the clip (`WorkAction.items`), so any body × any action just works:
 * dropping 'chọt lon' onto the hauler equips the stick and bag on him.
 */
export const CHARACTERS: readonly CharacterSpec[] = [
  { id: 've-chai', prefix: 've chai', make: (variant) => createPersonSprite(variant, 'straw') },
  { id: 'khuan-vac', prefix: 'khuân vác', make: (variant) => createHaulerSprite(variant) },
  { id: 'trong', prefix: 'nhân vật trống', make: (variant) => createPersonSprite(variant, 'none') },
]

const CHAR_SCALE = 3
const BAG_CANS = 3

interface CharActor {
  sprite: PersonSprite
  bag: HeldItem | undefined
  clock: number
  phase: number
  cans: number
  prevP: number
}

/**
 * One body × one clip: the three colour variants run the chosen action side by
 * side, each dressed with the action's kit. The poke bag mirrors the game
 * actor's loop — jabs knock cans in, the bag swells to three, then empties.
 */
export function buildCharacters(characterId: string, clipId: string): StageBuilder {
  return (): StageScene => {
    const character = CHARACTERS.find((entry) => entry.id === characterId)
    const clip = CHARACTER_CLIPS.find((entry) => entry.id === clipId)
    if (!character || !clip) throw new Error(`no character combo "${characterId}" × "${clipId}"`)
    const action = clip.action

    const root = new Container()
    const cells: StageCell[] = []
    const particles = new Particles()
    const actors: CharActor[] = []
    const cellW = 110
    const cellH = 122
    const letters = ['A', 'B', 'C']
    let facing: 1 | -1 = 1
    let paused = false

    for (let variant = 0; variant < 3; variant++) {
      const sprite = character.make(variant)
      sprite.container.scale.set(CHAR_SCALE)
      sprite.container.position.set(variant * cellW + cellW / 2, cellH - 18)
      root.addChild(sprite.container)
      const gear: Record<string, HeldItem> = action?.items ? equipItems(sprite, action.items) : {}
      const phase = variant * 0.4
      actors.push({
        sprite,
        bag: gear['bag'],
        clock: phase,
        phase,
        cans: 0,
        prevP: action ? (phase % action.beat) / action.beat : -1,
      })
      cells.push({
        label: `${character.prefix} ${letters[variant] ?? ''}`,
        x: variant * cellW,
        y: cellH - 16,
        width: cellW,
        height: 14,
      })
    }
    root.addChild(particles.container)

    const knockCan = (actor: CharActor): void => {
      actor.cans = actor.cans >= BAG_CANS ? 0 : actor.cans + 1
      actor.bag?.setFill(actor.cans / BAG_CANS)
      const origin = actor.sprite.container.position
      const front = origin.x + facing * 13 * CHAR_SCALE
      const bagX = origin.x - facing * 8 * CHAR_SCALE
      // The same arc the alley actor uses for a scrap bit, scaled to the sheet.
      particles.spawn(createScrapBit(actor.cans), front, origin.y - 8 * CHAR_SCALE, {
        vx: (bagX - front) / 0.16,
        vy: -14 * CHAR_SCALE,
        life: 0.32,
        gravity: 68 * CHAR_SCALE,
      })
    }

    return {
      root,
      width: cellW * 3,
      height: cellH + 6,
      cells,
      api: {
        setFacing: (value) => {
          facing = value
        },
        setPaused: (value) => {
          paused = value
        },
      },
      update: (dt) => {
        for (const actor of actors) {
          actor.sprite.container.scale.set(CHAR_SCALE * facing, CHAR_SCALE)
          if (paused) continue
          actor.clock += dt
          if (action) {
            const p = (actor.clock % action.beat) / action.beat
            restPose(actor.sprite)
            action.apply(actor.sprite, p)
            if (actor.bag && action.id === POKE.id && actor.prevP < 0.5 && p >= 0.5) knockCan(actor)
            actor.prevP = p
          } else {
            actor.prevP = -1
            walkPose(actor.sprite, actor.clock)
          }
        }
        if (!paused) particles.update(dt)
      },
    }
  }
}

/** Props and vehicles with their wheels actually spinning. */
export function buildProps(): StageScene {
  const root = new Container()
  const cells: StageCell[] = []
  const spins: { wheel: SpokeWheel; speed: number }[] = []

  const wheel = createSpokeWheel(4)
  spins.push({ wheel, speed: 52 })

  const smalls: { label: string; node: Container; x: number }[] = [
    { label: 'bao tải', node: createSack(1), x: 40 },
    { label: 'mảnh sắt', node: createScrapBit(0), x: 136 },
    { label: 'dây thép', node: createScrapBit(1), x: 232 },
    { label: 'bánh nan hoa', node: wheel.container, x: 328 },
  ]
  const smallCell = 96
  for (const item of smalls) {
    item.node.scale.set(3)
    item.node.position.set(item.x, 34)
    root.addChild(item.node)
    cells.push({ label: item.label, x: item.x - 48, y: 74, width: smallCell, height: 14 })
  }

  const cart = createCartSprite(0)
  cart.container.scale.set(2)
  cart.container.position.set(150, 190)
  for (const cartWheel of cart.wheels) spins.push({ wheel: cartWheel, speed: 52 })

  const truck = createTruckSprite(0)
  truck.container.scale.set(2)
  truck.container.position.set(430, 190)
  for (const truckWheel of truck.wheels) spins.push({ wheel: truckWheel, speed: 60 })

  const pickup = createPickupSprite(0)
  pickup.container.scale.set(2)
  pickup.container.position.set(150, 320)
  for (const pickupWheel of pickup.wheels) spins.push({ wheel: pickupWheel, speed: 52 })

  const routeTruck = createRouteTruckSprite(0)
  routeTruck.container.scale.set(2)
  routeTruck.container.position.set(430, 340)
  for (const routeWheel of routeTruck.wheels) spins.push({ wheel: routeWheel, speed: 60 })

  // Xe xuất nhìn thẳng (hướng nam): view dùng khi nó chạy xuống driveway. Bánh
  // trong view này là MẶT LỐP (gai dọc) nên không có nan hoa để quay.
  const truckFront = createTruckFrontSprite(0)
  truckFront.container.scale.set(2)
  truckFront.container.position.set(300, 250)

  // Biến thể hướng tây: chính art hông xe lật `scale.x` — bản dùng khi xe chạy về
  // tây trên đường lớn, y như mọi nhân vật/xe khác quay mặt.
  const truckWest = createTruckSprite(0)
  truckWest.container.scale.set(-2, 2)
  truckWest.container.position.set(560, 250)

  root.addChild(
    cart.container,
    truck.container,
    pickup.container,
    routeTruck.container,
    truckFront.container,
    truckWest.container,
  )
  cells.push({ label: 'xe ba gác', x: 40, y: 196, width: 220, height: 14 })
  cells.push({ label: 'xe tải (cổng xuất)', x: 330, y: 196, width: 220, height: 14 })
  cells.push({ label: 'xe tải (nhìn thẳng)', x: 240, y: 256, width: 130, height: 14 })
  cells.push({ label: 'xe tải (hướng tây)', x: 470, y: 256, width: 130, height: 14 })
  cells.push({ label: 'xe bán tải', x: 40, y: 326, width: 220, height: 14 })
  cells.push({ label: 'xe tải thùng (route)', x: 330, y: 346, width: 220, height: 14 })

  return {
    root,
    width: 620,
    height: 372,
    cells,
    update: (dt) => {
      for (const { wheel: item, speed } of spins) item.spin(speed, dt)
    },
  }
}

/** A full zone detail scene with a fake state so every actor shows up. */
export function buildZone(zoneId: string, scale: number, tier = 0): StageBuilder {
  return (app: Application): StageScene => {
    const layout = ZONE_LAYOUTS[zoneId]
    const factory = detailSceneFor(zoneId as ZoneId)
    if (!layout || !factory) throw new Error(`no detail scene for zone "${zoneId}"`)
    const painter = new TilePainter(app.renderer, SCRAP_YARD_PACK)
    const detail = factory(layout.rect, painter, DEFAULT_SERVICES)
    detail.setState({
      workers: 3,
      actions: { pick: 2, haul: 1 },
      earnedLog10: 5,
      tier,
      labels: STUDIO_LABELS,
      stock01: 0.6,
    })
    const root = new Container()
    root.addChild(detail.root)
    root.scale.set(scale)
    root.position.set(-layout.rect.x * scale, -layout.rect.y * scale)
    return {
      root,
      width: layout.rect.width * scale,
      height: layout.rect.height * scale,
      update: (dt, elapsed) => detail.update(dt, elapsed),
    }
  }
}

/** Schematic map: zone rects, their styles and the asphalt links between them. */
export function buildLayout(): StageScene {
  const root = new Container()
  const cells: StageCell[] = []
  root.addChild(new Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: 0x223018, alpha: 0.45 }))
  for (const rect of CONNECTORS) {
    root.addChild(new Graphics().rect(rect.x, rect.y, rect.width, rect.height).fill({ color: 0x5b6472, alpha: 0.9 }))
    root.addChild(
      new Graphics()
        .rect(rect.x, rect.y, rect.width, rect.height)
        .stroke({ width: 1, color: 0x8c96a4, alpha: 0.6 }),
    )
  }
  for (const patch of CLEARINGS) {
    const rect = patch.rect
    const fill = patch.kind === 'gravel' ? 0x767468 : 0x8a7550
    root.addChild(new Graphics().rect(rect.x, rect.y, rect.width, rect.height).fill({ color: fill, alpha: 0.55 }))
    root.addChild(
      new Graphics()
        .rect(rect.x, rect.y, rect.width, rect.height)
        .stroke({
          width: patch.elevation ? 2 : 1,
          color: patch.elevation ? 0xf0e6d2 : patch.kind === 'gravel' ? 0x9a988b : 0xa08a63,
          alpha: patch.elevation ? 0.95 : 0.7,
        }),
    )
    if (patch.elevation) {
      cells.push({
        label: `cao độ ${patch.elevation}`,
        x: rect.x + 4,
        y: rect.y + 4,
        width: rect.width - 8,
        height: 12,
        kind: 'label',
      })
    }
  }
  for (const area of WATER_AREAS) {
    const rect = area.rect
    root.addChild(
      new Graphics()
        .ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2)
        .fill({ color: 0x46759a, alpha: 0.95 }),
    )
    root.addChild(
      new Graphics()
        .ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2)
        .stroke({ width: 1, color: area.outside === 'dirt' ? 0xa08a63 : 0x9fd4e8, alpha: 0.7 }),
    )
  }
  for (const [zoneId, layout] of Object.entries(ZONE_LAYOUTS)) {
    const { rect, style } = layout
    root.addChild(new Graphics().rect(rect.x, rect.y, rect.width, rect.height).fill({ color: style.color, alpha: 0.28 }))
    root.addChild(
      new Graphics()
        .rect(rect.x, rect.y, rect.width, rect.height)
        .stroke({ width: 2, color: style.color, alpha: 0.95 }),
    )
    cells.push({ label: zoneId, x: rect.x + 8, y: rect.y + 8, width: rect.width - 16, height: 16 })
  }

  // Tuyến courier được phép chạy giữa hai khu (`ui/scene/couriers.ts`): path + điểm
  // xuất phát + mũi tên chiều giao hàng + nhãn "khu → khu · hàng". Xanh = đi bộ,
  // vàng = xe. Đây là bảng duy nhất quyết định khu nào nối khu nào.
  const CARGO_LABELS: Record<string, string> = { sack: 'bao', billet: 'phôi', pallet: 'pallet', crate: 'kiện' }
  for (const [key, run] of Object.entries(COURIER_RUNS)) {
    const first = run.path[0]
    if (!first) continue
    const [from = '', to = ''] = key.split('>')
    const color = run.kind === 'drive' ? 0xf0b45a : 0x86e3ad
    const line = new Graphics().moveTo(first.x, first.y)
    for (let i = 1; i < run.path.length; i++) {
      const point = run.path[i]
      if (point) line.lineTo(point.x, point.y)
    }
    line.stroke({ width: run.kind === 'drive' ? 3 : 2, color, alpha: 0.95 })
    root.addChild(line)
    root.addChild(new Graphics().circle(first.x, first.y, 4).fill({ color, alpha: 0.95 }))

    const last = run.path[run.path.length - 1]
    const prev = run.path[run.path.length - 2]
    if (last && prev) {
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x)
      const size = 8
      const arrow = new Graphics()
      arrow.moveTo(last.x, last.y)
      arrow.lineTo(last.x - Math.cos(angle - 0.55) * size, last.y - Math.sin(angle - 0.55) * size)
      arrow.lineTo(last.x - Math.cos(angle + 0.55) * size, last.y - Math.sin(angle + 0.55) * size)
      arrow.closePath()
      arrow.fill({ color, alpha: 0.95 })
      root.addChild(arrow)
    }

    // Nhãn đặt ở giữa path để không đè lên cổng khu.
    const lengths: number[] = []
    let total = 0
    for (let i = 1; i < run.path.length; i++) {
      const a = run.path[i - 1]
      const b = run.path[i]
      const span = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0
      lengths.push(span)
      total += span
    }
    let walked = 0
    let mid = first
    for (let i = 1; i < run.path.length; i++) {
      const a = run.path[i - 1]
      const b = run.path[i]
      const span = lengths[i - 1] ?? 0
      if (!a || !b) continue
      if (walked + span >= total / 2) {
        const t = span > 0 ? (total / 2 - walked) / span : 0
        mid = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
        break
      }
      walked += span
    }
    const drive = run.kind === 'drive' ? ' (xe)' : ''
    cells.push({
      label: `${from} → ${to} · ${CARGO_LABELS[run.cargo] ?? run.cargo}${drive}`,
      x: mid.x - 80,
      y: mid.y - 22,
      width: 160,
      height: 14,
      kind: 'label',
    })
  }
  // Mọi ô nhãn sống ở toạ độ world; sơ đồ vẽ ở tỉ lệ thu nhỏ nên ô cũng thu theo.
  root.scale.set(LAYOUT_SCALE)
  return {
    root,
    width: Math.round(WORLD_WIDTH * LAYOUT_SCALE),
    height: Math.round(WORLD_HEIGHT * LAYOUT_SCALE),
    cells: cells.map((cell) => ({ ...cell, x: cell.x * LAYOUT_SCALE, y: cell.y * LAYOUT_SCALE })),
  }
}

/**
 * Weather kinds for the studio tab. The studio can't read `@content` (dependency
 * rule), so — like `STUDIO_LABELS` — it carries its own sample numbers; the real
 * game profile lives in `src/content/weather.ts`.
 */
export const STUDIO_WEATHER_KINDS: readonly WeatherKindDef[] = [
  {
    id: 'clear',
    label: { vi: 'Nắng', en: 'Clear' },
    weight: 30,
    workMultiplier: 1,
    visual: { cloudCover: 0.15, rain: 0, wind: 0.25, lightning: 0 },
  },
  {
    id: 'cloudy',
    label: { vi: 'Nhiều mây', en: 'Cloudy' },
    weight: 26,
    workMultiplier: 0.97,
    visual: { cloudCover: 0.8, rain: 0, wind: 0.35, lightning: 0 },
  },
  {
    id: 'rain',
    label: { vi: 'Mưa rào', en: 'Rain' },
    weight: 20,
    workMultiplier: 0.9,
    visual: { cloudCover: 0.95, rain: 0.7, wind: 0.55, lightning: 0 },
  },
  {
    id: 'windy',
    label: { vi: 'Gió mạnh', en: 'Windy' },
    weight: 12,
    workMultiplier: 0.95,
    visual: { cloudCover: 0.55, rain: 0.15, wind: 1, lightning: 0 },
  },
  {
    id: 'storm',
    label: { vi: 'Bão', en: 'Storm' },
    weight: 12,
    workMultiplier: 0.75,
    visual: { cloudCover: 1, rain: 1, wind: 1.35, lightning: 8 },
  },
]

const STUDIO_WEATHER_PROFILE: WeatherProfile = {
  blockSeconds: 480,
  transitionSeconds: 24,
  kinds: STUDIO_WEATHER_KINDS,
}

/** Lịch trong studio chạy nhanh ×8 để thấy chuyển mùa khi ngồi xem. */
const STUDIO_SCHEDULE_SPEED = 8

function zoneDetails(painter: TilePainter): DetailScene[] {
  const details: DetailScene[] = []
  for (const zoneId of Object.keys(ZONE_LAYOUTS)) {
    const layout = ZONE_LAYOUTS[zoneId]
    const factory = detailSceneFor(zoneId as ZoneId)
    if (!layout || !factory) continue
    const detail = factory(layout.rect, painter, DEFAULT_SERVICES)
    detail.setState({
      workers: 2,
      actions: { pick: 1, haul: 1 },
      earnedLog10: 6,
      tier: 0,
      labels: STUDIO_LABELS,
      stock01: 0.6,
    })
    details.push(detail)
  }
  return details
}

/** The core district as the game paints it, with the shared lighting layer on top. */
export function buildLightingWorld(initialTime: number): StageBuilder {
  return (app: Application): StageScene => {
    const painter = new TilePainter(app.renderer, SCRAP_YARD_PACK)
    const root = new Container()
    const decor = new Graphics()
    paintWorldGrounds(painter, root, decor, CORE_WINDOW)
    root.addChild(decor)
    root.position.set(-CORE_WINDOW.x, -CORE_WINDOW.y)

    const details = zoneDetails(painter)
    for (const detail of details) root.addChild(detail.root)

    const lighting = createLighting({ width: CORE_WINDOW.width, height: CORE_WINDOW.height }, SCRAP_SCENERY.lights, {
      auto: false,
      time: initialTime,
    })
    root.addChild(lighting.container)

    return {
      root,
      width: CORE_WINDOW.width,
      height: CORE_WINDOW.height,
      api: { setTime: (time: number) => lighting.setTime(time) },
      update: (dt, elapsed) => {
        for (const detail of details) detail.update(dt, elapsed)
        lighting.update(dt, CORE_WINDOW)
      },
    }
  }
}

/** Like `buildLightingWorld` but with ambience + the real weather layer (and audio). */
export function buildWeatherWorld(initialTime: number): StageBuilder {
  return (app: Application): StageScene => {
    const painter = new TilePainter(app.renderer, SCRAP_YARD_PACK)
    const root = new Container()
    const decor = new Graphics()
    paintWorldGrounds(painter, root, decor, CORE_WINDOW)
    root.addChild(decor)
    root.position.set(-CORE_WINDOW.x, -CORE_WINDOW.y)

    const details = zoneDetails(painter)
    for (const detail of details) root.addChild(detail.root)

    const ambience = createAmbience(SCRAP_SCENERY.ambience)
    // Cross-zone couriers: one per declared run, derived from the runs table so
    // the preview never drifts from the game's route set.
    const courierLegs: CourierLeg[] = Object.keys(COURIER_RUNS).map((key) => {
      const [from = '', to = ''] = key.split('>')
      return { workerId: key, from, to }
    })
    const couriers = createCouriers(courierLegs)
    couriers.setFeed({
      playTimeS: 0,
      earnedLog10: 0,
      zones: {},
      workers: Object.fromEntries(courierLegs.map((leg) => [leg.workerId, 1])),
    })
    const weather = createWeather({ profile: STUDIO_WEATHER_PROFILE })
    const lighting = createLighting({ width: CORE_WINDOW.width, height: CORE_WINDOW.height }, SCRAP_SCENERY.lights, {
      auto: false,
      time: initialTime,
    })
    root.addChild(couriers.root, ambience.container, weather.container, lighting.container, weather.flash)

    return {
      root,
      width: CORE_WINDOW.width,
      height: CORE_WINDOW.height,
      api: {
        setTime: (time: number) => lighting.setTime(time),
        setWeather: (kindId: string | null) =>
          weather.setOverride(kindId === null ? null : (STUDIO_WEATHER_KINDS.find((k) => k.id === kindId) ?? null)),
        strike: () => weather.strike(),
      },
      update: (dt, elapsed) => {
        for (const detail of details) detail.update(dt, elapsed)
        couriers.update(dt, CORE_WINDOW)
        ambience.update(dt, weather.wind(), CORE_WINDOW)
        weather.update(dt, elapsed * STUDIO_SCHEDULE_SPEED, CORE_WINDOW)
        lighting.update(dt, CORE_WINDOW)
      },
    }
  }
}
