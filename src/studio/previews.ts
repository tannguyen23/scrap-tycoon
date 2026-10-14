import type { WeatherKindDef, WeatherProfile, ZoneId } from '@domain/types'
import { Application, Container, Graphics, Sprite } from 'pixi.js'
import { createAmbience } from '@ui/scene/ambience'
import { COURIER_RUNS, createCouriers, type CourierLeg } from '@ui/scene/couriers'
import { createHaulerSprite } from '@ui/scene/focus/depot/sprites'
import { createTruckSprite } from '@ui/scene/focus/gate/sprites'
import { equipItems, type HeldItem } from '@ui/scene/focus/heldItems'
import { POKE, WORK_ACTIONS, restPose, walkPose, type WorkAction } from '@ui/scene/focus/poses'
import {
  Particles,
  createPersonSprite,
  createSack,
  createScrapBit,
  createSpokeWheel,
  type PersonSprite,
  type SpokeWheel,
} from '@ui/scene/focus/parts'
import { createCartSprite, createPickupSprite, createRouteTruckSprite } from '@ui/scene/focus/route/sprites'
import { detailSceneFor } from '@ui/scene/focus'
import type { DetailScene } from '@ui/scene/focus/types'
import { createLighting } from '@ui/scene/lighting'
import { makeRandom } from '@ui/scene/random'
import { createWeather } from '@ui/scene/weather'
import { DECOR_SPECIMENS, drawBush, drawStump, drawTree } from '@ui/scene/decorItems'
import { TilePainter } from '@ground/core/painter'
import { drawDebrisItem, drawFloraItem, drawWaterItem } from '@ground/packs/scrapYard/specimens'
import {
  paintDragMarks,
  paintFootprints,
  paintPuddle,
  paintRuts,
  paintStain,
  paintWearPath,
} from '@ground/packs/scrapYard/decals'
import { TILE_SIZE, blobContour, cornerMask } from '@ground/core/edgeGeometry'
import { generateEdgeTiles } from '@ground/core/edgeTiles'
import { generateTileSet } from '@ground/core/tileSet'
import { TILE_KINDS, type TileKind } from '@ground/packs/scrapYard/terrains'
import { paintGrounds, type GroundMap } from '@ground/core/grounds'
import type { GroundPack } from '@ground/core/pack'
import { SCRAP_YARD_PACK, scrapTerrain } from '@ground/packs/scrapYard/pack'
import { paintWorldGrounds } from '@ground/packs/scrapYard/worldGrounds'
import { scatterDensity } from '@ground/core/variety'
import { CLEARINGS, CONNECTORS, WATER_AREAS, WORLD_HEIGHT, WORLD_WIDTH, ZONE_LAYOUTS } from '@ui/scene/zoneLayout'
import type { StageBuilder, StageCell, StageScene } from './types'

const TILE_CELL = 64
const TILE_SCALE = 3

/** Every generated tile kind × variant, as a labelled sheet. */
export function buildTiles(app: Application, pack: GroundPack = SCRAP_YARD_PACK): StageScene {
  const set = generateTileSet(app.renderer, pack)
  const kinds = pack.terrains.map((terrain) => terrain.id)
  const root = new Container()
  const cells: StageCell[] = []
  const columns = Math.max(...kinds.map((kind) => (set[kind] ?? []).length))
  kinds.forEach((kind, row) => {
    const textures = set[kind] ?? []
    textures.forEach((texture, variant) => {
      const sprite = new Sprite(texture)
      sprite.scale.set(TILE_SCALE)
      sprite.position.set(variant * TILE_CELL + 8, row * TILE_CELL + 6)
      root.addChild(sprite)
      cells.push({
        label: `${kind} · ${variant}`,
        x: variant * TILE_CELL,
        y: row * TILE_CELL + 6 + TILE_CELL - 18,
        width: TILE_CELL,
        height: 14,
      })
    })
  })
  return {
    root,
    width: TILE_CELL * columns + 16,
    height: TILE_CELL * TILE_KINDS.length + 8,
    cells,
  }
}

const FLORA_LABELS = ['hoa cúc', 'hoa vàng', 'hoa hồng', 'hoa xanh', 'cỏ rậm', 'nấm', 'bụi nhỏ', 'cỏ ba lá']
const DEBRIS_LABELS = ['sỏi', 'cành khô', 'lá rụng', 'đá nhỏ', 'vết nứt']
const WATER_LABELS = [
  'váng dầu',
  'lá trôi',
  'vỏ lon',
  'bọt nước',
  'cành trôi',
  'bèo',
  'gợn sóng',
  'chai',
  'bông lục bình',
  'bèo tấm',
  'hoa sen',
  'lá súng',
]

/**
 * The 14 mixed corner cases grouped into the four contour families, walked
 * clockwise, so the sheet reads as shapes instead of a wall of numbers.
 */
export const EDGE_FAMILIES: readonly { caption: string; masks: readonly number[] }[] = [
  { caption: 'Một góc trong — 1 TL · 2 TR · 4 BR · 8 BL', masks: [1, 2, 4, 8] },
  { caption: 'Hai góc kề (nửa mặt) — 3 trên · 6 phải · 12 dưới · 9 trái', masks: [3, 6, 12, 9] },
  { caption: 'Hai góc đối (chéo) — 5 TL+BR · 10 TR+BL', masks: [5, 10] },
  { caption: 'Khuyết một góc — 14 thiếu TL · 13 thiếu TR · 11 thiếu BR · 7 thiếu BL', masks: [14, 13, 11, 7] },
]

const EDGE_CELL_W = 104
const EDGE_CELL_H = 86

/**
 * Transition tiles for one terrain pair, grouped by contour family, both variants
 * per case. Reads top→bottom: each group is a family, each cell shows variant 0 | 1.
 */
export function buildEdgeSheet(inside: TileKind, outside: TileKind): StageBuilder {
  return (app: Application): StageScene => {
    const edges = generateEdgeTiles(app.renderer, scrapTerrain(inside), scrapTerrain(outside))
    const root = new Container()
    const cells: StageCell[] = []

    EDGE_FAMILIES.forEach((family, familyIndex) => {
      const baseY = familyIndex * EDGE_CELL_H + 18
      cells.push({
        label: family.caption,
        x: 0,
        y: baseY - 18,
        width: EDGE_CELL_W * 4,
        height: 14,
        kind: 'caption',
      })
      family.masks.forEach((mask, index) => {
        const variants = edges[mask] ?? []
        const x = index * EDGE_CELL_W
        variants.forEach((texture, variant) => {
          const sprite = new Sprite(texture)
          sprite.scale.set(3)
          sprite.position.set(x + 6 + variant * 52, baseY + 2)
          root.addChild(sprite)
        })
        cells.push({
          label: `mask ${mask} · ${maskCorners(mask)}`,
          mask,
          x,
          y: baseY + 52,
          width: EDGE_CELL_W,
          height: 14,
          kind: 'label',
        })
      })
    })

    // Cặp có vách: thêm một hàng cho dải chân vách (bóng đổ nối tiếp). — vách giờ
    // vẽ theo đa giác ở khung "Chỗ nối", nên bảng tile không cần hàng này.
    return {
      root,
      width: EDGE_CELL_W * 4,
      height: EDGE_FAMILIES.length * EDGE_CELL_H + 20,
      cells,
    }
  }
}

/** "TL+TR" style description of a corner mask. */
export function maskCorners(mask: number): string {
  const parts: string[] = []
  if (mask & 1) parts.push('TL')
  if (mask & 2) parts.push('TR')
  if (mask & 4) parts.push('BR')
  if (mask & 8) parts.push('BL')
  return parts.join('+')
}

const FIELD_STEP = 12

/**
 * The clutter-density field itself, bucketed into clean / sparse / normal /
 * dense, so the spread can be judged and tuned without eyeballing the map.
 */
export function buildScatterField(): StageScene {
  const root = new Container()
  const g = new Graphics()
  const cols = Math.ceil(WORLD_WIDTH / FIELD_STEP)
  const rows = Math.ceil(WORLD_HEIGHT / FIELD_STEP)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * FIELD_STEP
      const y = row * FIELD_STEP
      const density = scatterDensity(x, y, 41)
      if (density <= 0.02) continue
      const color = density < 0.18 ? 0xf5f0e0 : density < 0.55 ? 0x9ad46f : density < 0.85 ? 0xffb454 : 0xf08a6a
      g.rect(x, y, FIELD_STEP - 1, FIELD_STEP - 1).fill({ color, alpha: 0.2 + density * 0.75 })
    }
  }
  root.addChild(g)
  return {
    root,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    cells: [
      { label: 'sạch (0–0.18) — không rải gì', x: 14, y: 14, width: 260, height: 14, kind: 'label' },
      { label: 'thưa (0.18–0.55) — 1 món/ô', x: 14, y: 32, width: 260, height: 14, kind: 'label' },
      { label: 'vừa (0.55–0.85) — 2 món/ô', x: 14, y: 50, width: 260, height: 14, kind: 'label' },
      { label: 'dày (0.85–1) — 3 món/ô + cụm sỏi trong mảng đất', x: 14, y: 68, width: 380, height: 14, kind: 'label' },
    ],
  }
}

const TRACE_SCALE = 2

/** Ground decal lab: one dirt patch wearing every usage trace, labelled. */
export function buildTraces(app: Application): StageScene {
  const painter = new TilePainter(app.renderer, SCRAP_YARD_PACK)
  const view = { x: 0, y: 0, width: 300, height: 140 }
  const root = new Container()
  painter.paint(root, view, 'dirt', 21)
  painter.scatter(root, view, 22, 'debris', 20)

  const decals = new Graphics()
  paintWearPath(decals, [{ x: 24, y: 108 }, { x: 140, y: 84 }, { x: 276, y: 100 }], { seed: 31 })
  paintFootprints(decals, [{ x: 24, y: 108 }, { x: 140, y: 84 }], { seed: 32 })
  paintRuts(decals, [{ x: 30, y: 34 }, { x: 270, y: 26 }], { seed: 33 })
  paintDragMarks(decals, [{ x: 52, y: 62 }, { x: 132, y: 70 }], { seed: 34 })
  paintStain(decals, { x: 208, y: 108 }, { radius: 18, soot: true, seed: 35 })
  paintStain(decals, { x: 268, y: 62 }, { radius: 13, seed: 36 })
  paintPuddle(decals, 96, 26, 9, 3.6, 37)
  paintPuddle(decals, 236, 92, 6, 2.8, 38)
  root.addChild(decals)
  root.scale.set(TRACE_SCALE)

  const s = TRACE_SCALE
  return {
    root,
    width: view.width * s,
    height: view.height * s,
    cells: [
      { label: 'đường mòn + vết chân', x: 24 * s, y: 122 * s, width: 150 * s, height: 14, kind: 'label' },
      { label: 'rãnh bánh xe', x: 30 * s, y: 4 * s, width: 120 * s, height: 14, kind: 'label' },
      { label: 'vệt kéo bao', x: 52 * s, y: 74 * s, width: 100 * s, height: 14, kind: 'label' },
      { label: 'than + tro', x: 178 * s, y: 124 * s, width: 80 * s, height: 14, kind: 'label' },
      { label: 'vết dầu', x: 248 * s, y: 78 * s, width: 70 * s, height: 14, kind: 'label' },
      { label: 'vũng nước', x: 84 * s, y: 34 * s, width: 70 * s, height: 14, kind: 'label' },
    ],
  }
}

/** Flora on grass + debris on dirt, one specimen per cell. */
export function buildScatter(app: Application): StageScene {
  const set = generateTileSet(app.renderer, SCRAP_YARD_PACK)
  const root = new Container()
  const cells: StageCell[] = []
  const cellW = 56
  const rowH = 82

  const rows: {
    kind: TileKind
    labels: readonly string[]
    draw: (g: Graphics, x: number, y: number, kind: number, rnd: () => number) => void
  }[] = [
    { kind: 'grass', labels: FLORA_LABELS, draw: drawFloraItem },
    { kind: 'dirt', labels: DEBRIS_LABELS, draw: drawDebrisItem },
    { kind: 'water', labels: WATER_LABELS, draw: drawWaterItem },
  ]

  rows.forEach((row, rowIndex) => {
    const bgTexture = (set[row.kind] ?? [])[0]
    row.labels.forEach((label, kind) => {
      const x = kind * cellW + 4
      const y = rowIndex * rowH + 4
      if (bgTexture) {
        const bg = new Sprite(bgTexture)
        bg.scale.set(TILE_SCALE)
        bg.position.set(x, y)
        root.addChild(bg)
      }
      const item = new Graphics()
      row.draw(item, 0, 0, kind, makeRandom(kind * 131 + rowIndex * 17 + 5))
      item.scale.set(TILE_SCALE)
      item.position.set(x + 26, y + 46)
      root.addChild(item)
      cells.push({ label, x, y: y + 50, width: cellW, height: 14 })
    })
  })

  return {
    root,
    width: cellW * Math.max(FLORA_LABELS.length, DEBRIS_LABELS.length, WATER_LABELS.length) + 8,
    height: rowH * rows.length + 4,
    cells,
  }
}

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

  root.addChild(cart.container, truck.container, pickup.container, routeTruck.container)
  cells.push({ label: 'xe ba gác', x: 40, y: 196, width: 220, height: 14 })
  cells.push({ label: 'xe tải (cổng xuất)', x: 330, y: 196, width: 220, height: 14 })
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

/** Popup wording for studio previews — the real labels come localized from content. */
const STUDIO_LABELS = { produced: 'Sắt vụn', money: 'Tiền' }

/** A full zone detail scene with a fake state so every actor shows up. */
export function buildZone(zoneId: string, scale: number, tier = 0): StageBuilder {
  return (app: Application): StageScene => {
    const layout = ZONE_LAYOUTS[zoneId]
    const factory = detailSceneFor(zoneId as ZoneId)
    if (!layout || !factory) throw new Error(`no detail scene for zone "${zoneId}"`)
    const painter = new TilePainter(app.renderer, SCRAP_YARD_PACK)
    const detail = factory(layout.rect, painter)
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

const SEAM_VIEW = { x: 400, y: 168, width: 176, height: 104 }
const SEAM_SCALE = 3
const SEAM_BLOB = { x: SEAM_VIEW.x + 44, y: SEAM_VIEW.y + 20, width: 88, height: 64 }
const SEAM_PAD = 18

/**
 * Zoomed-in seam lab: the `outside` terrain, then a clearing of `kind` with its
 * fringe. Every edge tile gets a chip with the mask it resolved to, so the
 * numbers can be matched against the transition-tile sheet.
 */
export function buildSeam(kind: TileKind, seed: number, outside: TileKind = 'grass', cliff = false): StageBuilder {
  return (app: Application): StageScene => {
    const painter = new TilePainter(app.renderer, SCRAP_YARD_PACK)
    const expanded = {
      x: SEAM_VIEW.x - 40,
      y: SEAM_VIEW.y - 40,
      width: SEAM_VIEW.width + 80,
      height: SEAM_VIEW.height + 80,
    }
    const root = new Container()
    if (outside === 'grass') {
      painter.paint(root, expanded, 'grass', 7)
      painter.patchwork(root, expanded, 31)
      painter.scatter(root, expanded, 41, 'flora')
    } else {
      painter.paint(root, expanded, outside, 7 + (seed % 7))
    }
    painter.paintBlob(root, SEAM_BLOB, kind, seed, SEAM_PAD, outside, cliff ? 1 : 0)
    painter.scatter(root, expanded, 42, 'debris')

    if (outside === 'grass') {
      const decor = new Graphics()
      drawTree(decor, SEAM_VIEW.x + 18, SEAM_VIEW.y + 32)
      drawBush(decor, SEAM_VIEW.x + 152, SEAM_VIEW.y + 26)
      drawStump(decor, SEAM_VIEW.x + 132, SEAM_VIEW.y + 84)
      root.addChild(decor)
    }

    // Mask chips come from the same pure helpers the painter uses.
    const contour = blobContour(SEAM_BLOB, SEAM_PAD, seed)
    const cells: StageCell[] = []
    const startX = Math.floor((SEAM_BLOB.x - SEAM_PAD - TILE_SIZE) / TILE_SIZE) * TILE_SIZE
    const startY = Math.floor((SEAM_BLOB.y - SEAM_PAD - TILE_SIZE) / TILE_SIZE) * TILE_SIZE
    const endX = SEAM_BLOB.x + SEAM_BLOB.width + SEAM_PAD
    const endY = SEAM_BLOB.y + SEAM_BLOB.height + SEAM_PAD
    for (let y = startY; y < endY; y += TILE_SIZE) {
      for (let x = startX; x < endX; x += TILE_SIZE) {
        const mask = cornerMask(x, y, contour, seed)
        if (mask === 0 || mask === 15) continue
        if (x < SEAM_VIEW.x || x + TILE_SIZE > SEAM_VIEW.x + SEAM_VIEW.width) continue
        if (y < SEAM_VIEW.y || y + TILE_SIZE > SEAM_VIEW.y + SEAM_VIEW.height) continue
        cells.push({
          label: String(mask),
          mask,
          x: (x - SEAM_VIEW.x) * SEAM_SCALE,
          y: (y - SEAM_VIEW.y) * SEAM_SCALE,
          width: TILE_SIZE * SEAM_SCALE,
          height: 13,
          kind: 'tile',
        })
      }
    }

    root.scale.set(SEAM_SCALE)
    root.position.set(-SEAM_VIEW.x * SEAM_SCALE, -SEAM_VIEW.y * SEAM_SCALE)
    return {
      root,
      width: SEAM_VIEW.width * SEAM_SCALE,
      height: SEAM_VIEW.height * SEAM_SCALE,
      cells,
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
        .stroke({ width: patch.elevation ? 2 : 1, color: patch.elevation ? 0xf0e6d2 : patch.kind === 'gravel' ? 0x9a988b : 0xa08a63, alpha: patch.elevation ? 0.95 : 0.7 }),
    )
    if (patch.elevation) {
      cells.push({ label: `cao độ ${patch.elevation}`, x: rect.x + 4, y: rect.y + 4, width: rect.width - 8, height: 12, kind: 'label' })
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
  return { root, width: WORLD_WIDTH, height: WORLD_HEIGHT, cells }
}

/**
 * Any pack's own map, painted through the kit — the hub's world preview. The
 * game itself calls the same `paintGrounds`, so a pack previewed here is the
 * pack the game renders.
 */
export function buildPackWorld(pack: GroundPack, map: GroundMap): StageBuilder {
  return (app: Application): StageScene => {
    const painter = new TilePainter(app.renderer, pack)
    const root = new Container()
    const decor = new Graphics()
    paintGrounds(pack, map, painter, root, decor)
    root.addChild(decor)
    return { root, width: map.width, height: map.height }
  }
}

/** The whole yard as the game paints it, with the shared lighting layer on top. */
export function buildLightingWorld(initialTime: number): StageBuilder {
  return (app: Application): StageScene => {
    const painter = new TilePainter(app.renderer, SCRAP_YARD_PACK)
    const root = new Container()
    const decor = new Graphics()
    paintWorldGrounds(painter, root, decor)
    root.addChild(decor)

    const details: DetailScene[] = []
    for (const zoneId of Object.keys(ZONE_LAYOUTS)) {
      const layout = ZONE_LAYOUTS[zoneId]
      const factory = detailSceneFor(zoneId as ZoneId)
      if (!layout || !factory) continue
      const detail = factory(layout.rect, painter)
      detail.setState({
        workers: 2,
        actions: { pick: 1, haul: 1 },
        earnedLog10: 6,
        tier: 0,
        labels: STUDIO_LABELS,
        stock01: 0.6,
      })
      root.addChild(detail.root)
      details.push(detail)
    }

    const lighting = createLighting({ auto: false, time: initialTime })
    root.addChild(lighting.container)

    return {
      root,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      api: { setTime: (time: number) => lighting.setTime(time) },
      update: (dt, elapsed) => {
        for (const detail of details) detail.update(dt, elapsed)
        lighting.update(dt)
      },
    }
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

/** Like `buildLightingWorld` but with ambience + the real weather layer (and audio). */
export function buildWeatherWorld(initialTime: number): StageBuilder {
  return (app: Application): StageScene => {
    const painter = new TilePainter(app.renderer, SCRAP_YARD_PACK)
    const root = new Container()
    const decor = new Graphics()
    paintWorldGrounds(painter, root, decor)
    root.addChild(decor)

    const details: DetailScene[] = []
    for (const zoneId of Object.keys(ZONE_LAYOUTS)) {
      const layout = ZONE_LAYOUTS[zoneId]
      const factory = detailSceneFor(zoneId as ZoneId)
      if (!layout || !factory) continue
      const detail = factory(layout.rect, painter)
      detail.setState({
        workers: 2,
        actions: { pick: 1, haul: 1 },
        earnedLog10: 6,
        tier: 0,
        labels: STUDIO_LABELS,
        stock01: 0.6,
      })
      root.addChild(detail.root)
      details.push(detail)
    }

    const ambience = createAmbience()
    // Cross-zone couriers: one per declared run, derived from the runs table so
    // the preview never drifts from the game's route set.
    const courierLegs: CourierLeg[] = Object.keys(COURIER_RUNS).map((key) => {
      const [from = '', to = ''] = key.split('>')
      return { workerId: key, from, to }
    })
    const couriers = createCouriers(courierLegs)
    couriers.setCounts({
      workers: new Map(courierLegs.map((leg) => [leg.workerId, 1])),
      tiers: new Map(),
    })
    const weather = createWeather({ profile: STUDIO_WEATHER_PROFILE })
    const lighting = createLighting({ auto: false, time: initialTime })
    root.addChild(couriers.root, ambience.container, weather.container, lighting.container, weather.flash)

    return {
      root,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      api: {
        setTime: (time: number) => lighting.setTime(time),
        setWeather: (kindId: string | null) =>
          weather.setOverride(kindId === null ? null : (STUDIO_WEATHER_KINDS.find((k) => k.id === kindId) ?? null)),
        strike: () => weather.strike(),
      },
      update: (dt, elapsed) => {
        for (const detail of details) detail.update(dt, elapsed)
        couriers.update(dt, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT })
        ambience.update(dt, weather.wind())
        weather.update(dt, elapsed * STUDIO_SCHEDULE_SPEED)
        lighting.update(dt)
      },
    }
  }
}