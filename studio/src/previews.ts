import { Application, Container, Graphics, Sprite } from 'pixi.js'
import { TILE_SIZE, blobContour, cornerMask } from '@ground/core/edgeGeometry'
import { generateEdgeTiles } from '@ground/core/edgeTiles'
import { paintGrounds, type GroundMap } from '@ground/core/grounds'
import type { GroundPack } from '@ground/core/pack'
import { TilePainter } from '@ground/core/painter'
import { makeRandom } from '@ground/core/random'
import { generateTileSet } from '@ground/core/tileSet'
import { scatterDensity } from '@ground/core/variety'
import {
  paintDragMarks,
  paintFootprints,
  paintPuddle,
  paintRuts,
  paintStain,
  paintWearPath,
} from '@ground/packs/scrapYard/decals'
import { SCRAP_YARD_PACK, scrapTerrain } from '@ground/packs/scrapYard/pack'
import { drawDebrisItem, drawFloraItem, drawWaterItem } from '@ground/packs/scrapYard/specimens'
import { TILE_KINDS, type TileKind } from '@ground/packs/scrapYard/terrains'
import { SCRAP_MAP } from '@ground/packs/scrapYard/worldGrounds'
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
  const cols = Math.ceil(SCRAP_MAP.width / FIELD_STEP)
  const rows = Math.ceil(SCRAP_MAP.height / FIELD_STEP)
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
    width: SCRAP_MAP.width,
    height: SCRAP_MAP.height,
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

const SEAM_VIEW = { x: 400, y: 168, width: 176, height: 104 }
const SEAM_SCALE = 3
const SEAM_BLOB = { x: SEAM_VIEW.x + 44, y: SEAM_VIEW.y + 20, width: 88, height: 64 }
const SEAM_PAD = 18

/**
 * Zoomed-in seam lab: the `outside` terrain, then a clearing of `kind` with its
 * fringe. Every edge tile gets a chip with the mask it resolved to, so the
 * numbers can be matched against the transition-tile sheet. The kit draws it from
 * the ground pack; project decor stays out of this lab.
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
