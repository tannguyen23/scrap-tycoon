import { blobContour } from '@ground/core/edgeGeometry'
import { DEFAULT_BLOB_PAD } from '@ground/core/grounds'
import type { Rect } from '@ground/core/metrics'
import { DECOR_PLACEMENTS } from '@ground/packs/scrapYard/decorPlacements'
import { SCRAP_MAP } from '@ground/packs/scrapYard/worldGrounds'
import { ZONE_LAYOUTS, outlineRuns, type ZoneLayout } from '@ground/packs/scrapYard/worldLayout'
import { ALLEY_WORK_RUNS } from '@ui/scene/focus/alley/scene'
import { PLAYER_SPAWN } from '@ui/scene/player'
import { buildBlockers, canStand, slideMove, zoneAt, type Blockers } from '@ui/scene/player/walkable'
import { describe, expect, it } from 'vitest'

const blockers = buildBlockers()
const ALLEY = ZONE_LAYOUTS['alley']
if (!ALLEY) throw new Error('fixture is missing the alley layout')

/** Cỡ bước khi dò đường — cùng cỡ bước mà `slideMove` chia nhỏ. */
const STEP = 4
const STEPS = [
  [STEP, 0],
  [-STEP, 0],
  [0, STEP],
  [0, -STEP],
  [STEP, STEP],
  [STEP, -STEP],
  [-STEP, STEP],
  [-STEP, -STEP],
] as const

/**
 * Mép ngoài của mọi cổng khu: rào khai bằng `gates` (thửa mới) hay `fenceOpenings`
 * (thửa cũ) — chỗ người chơi bước vào, nên luôn phải đứng được.
 */
function gateMouths(layout: ZoneLayout): { x: number; y: number }[] {
  const mouths: { x: number; y: number }[] = []
  for (const gate of layout.gates ?? []) {
    mouths.push({ x: layout.rect.x + gate.at.x, y: layout.rect.y + gate.at.y })
  }
  for (const opening of layout.fenceOpenings ?? []) {
    const horizontal = opening.edge === 'north' || opening.edge === 'south'
    const along = (opening.from + opening.to) / 2
    mouths.push({
      x: layout.rect.x + (horizontal ? along : opening.edge === 'west' ? 0 : layout.rect.width),
      y: layout.rect.y + (horizontal ? (opening.edge === 'north' ? 0 : layout.rect.height) : along),
    })
  }
  return mouths
}

/** Chỗ đứng gần `spot` nhất (tâm thửa có thể nằm ngay trong đế một vật). */
function findStandable(blockers: Blockers, spot: { x: number; y: number }): { x: number; y: number } | null {
  for (let ring = 0; ring <= 12; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue
        const x = Math.round(spot.x) + dx * STEP
        const y = Math.round(spot.y) + dy * STEP
        if (canStand(blockers, x, y)) return { x, y }
      }
    }
  }
  return null
}

/** Mọi ô đứng được đi tới từ `start` bằng bước 4px trong hộp `around` (khoá theo toạ độ). */
function reachable(blockers: Blockers, start: { x: number; y: number }, around: Rect): Set<string> {
  const key = (x: number, y: number): string => `${x},${y}`
  const inside = (x: number, y: number): boolean =>
    x > around.x && y > around.y && x < around.x + around.width && y < around.y + around.height
  const seen = new Set<string>([key(start.x, start.y)])
  const queue: { x: number; y: number }[] = [start]
  while (queue.length > 0) {
    const at = queue.pop()
    if (!at) break
    for (const [dx, dy] of STEPS) {
      const nx = at.x + dx
      const ny = at.y + dy
      if (!inside(nx, ny) || seen.has(key(nx, ny))) continue
      // Kiểm cả nửa bước: đường rào mảnh, nhảy hai ô một là lọt qua.
      if (!canStand(blockers, at.x + dx / 2, at.y + dy / 2)) continue
      if (!canStand(blockers, nx, ny)) continue
      seen.add(key(nx, ny))
      queue.push({ x: nx, y: ny })
    }
  }
  return seen
}

describe('walkable map', () => {
  it('uses the very waterline the ground pass paints', () => {
    expect(blockers.polys.length).toBe(SCRAP_MAP.water.length)
    SCRAP_MAP.water.forEach((area, index) => {
      const painted = blobContour(area.rect, area.pad ?? DEFAULT_BLOB_PAD, area.seed)
      expect(blockers.polys[index]).toEqual(painted)
    })
  })

  it('lets a walker stand on the avenue and blocks the lake', () => {
    // The avenue band is open ground (its zone declares no fence at all).
    expect(canStand(blockers, 5120, 2880)).toBe(true)
    // Middle of the west lake — and dry ground well north of its bank is fine.
    expect(canStand(blockers, 1650, 3230)).toBe(false)
    expect(canStand(blockers, 1650, 2900)).toBe(true)
  })

  it('lets the avenue through and closes the alley ring but at its lanes', () => {
    // Vành bãi làm việc thụt 6px vào trong rect; cổng nam world x 4062..4134 (làn đất
    // xuống đại lộ), cổng đông world y 2196..2244 (lối mòn sang xưởng).
    const ringBottom = ALLEY.rect.y + 282
    const ringRight = ALLEY.rect.x + 394
    expect(canStand(blockers, 4098, ringBottom)).toBe(true)
    expect(canStand(blockers, 3950, ringBottom)).toBe(false)
    expect(canStand(blockers, ringRight, 2220)).toBe(true)
    expect(canStand(blockers, ringRight, 2300)).toBe(false)
    // The unfenced avenue band never blocks.
    expect(canStand(blockers, 4512, 2880)).toBe(true)
  })

  it('closes every yard ring except at its gates', () => {
    // Mỗi thửa có vành riêng: cổng cho qua, vành chặn, lòng thửa đứng được.
    let checked = 0
    for (const [id, layout] of Object.entries(ZONE_LAYOUTS)) {
      const outline = layout.outline
      if (!outline || outline.length < 3) continue
      checked++
      const gates = layout.gates ?? []
      expect(gates.length, `${id} phải có cổng`).toBeGreaterThan(0)
      const inWorld = (point: { x: number; y: number }) => ({
        x: layout.rect.x + point.x,
        y: layout.rect.y + point.y,
      })

      const gate = gates[0]
      if (gate) {
        const opening = inWorld(gate.at)
        expect(canStand(blockers, opening.x, opening.y), `${id}: cổng phải cho qua`).toBe(true)
      }

      const run = outlineRuns(outline, gates)[0]
      if (!run) throw new Error(`${id}: vành không có đoạn rào nào`)
      const onRun = inWorld({ x: (run.x1 + run.x2) / 2, y: (run.y1 + run.y2) / 2 })
      expect(canStand(blockers, onRun.x, onRun.y), `${id}: vành phải chặn`).toBe(false)

      const middle = inWorld({ x: layout.rect.width / 2, y: layout.rect.height / 2 })
      expect(canStand(blockers, middle.x, middle.y), `${id}: lòng thửa phải đứng được`).toBe(true)
    }
    expect(checked).toBeGreaterThanOrEqual(3)
  })

  it('keeps every straight run the alley crew walks clear of the rings', () => {
    // Picker/porter đi THẲNG giữa hai waypoint và KHÔNG va chạm gì (không pathfind) —
    // nên bất biến phải kiểm là *vành* không được cắt tuyến của họ. Bộ chặn đầy đủ có
    // thêm đế đống, mà tâm đống chính là waypoint của họ, nên ở đây dùng bộ chỉ-có-vành.
    const fencesOnly: Blockers = { rects: [], polys: blockers.polys, fences: blockers.fences }
    for (const [from, to] of ALLEY_WORK_RUNS) {
      const a = { x: ALLEY.rect.x + from.x, y: ALLEY.rect.y + from.y }
      const b = { x: ALLEY.rect.x + to.x, y: ALLEY.rect.y + to.y }
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2)
      for (let step = 0; step <= steps; step++) {
        const t = steps === 0 ? 0 : step / steps
        const x = a.x + (b.x - a.x) * t
        const y = a.y + (b.y - a.y) * t
        expect(
          canStand(fencesOnly, x, y),
          `chặng ${from.x},${from.y}→${to.x},${to.y} cắt vành ở ${Math.round(x)},${Math.round(y)}`,
        ).toBe(true)
      }
    }
  })

  it('blocks the base of every standing prop in a plot', () => {
    // Một mẫu mỗi thửa: đứng ngay chân vật thì không được, đứng kế bên thì được — nếu
    // không thì hoặc vật không chặn, hoặc nó chặn cả khoảng sân quanh nó.
    const samples = [
      { zone: 'alley', spot: { x: 60, y: 56 }, near: { x: 60, y: 96 } },
      { zone: 'alley', spot: { x: 368, y: 136 }, near: { x: 368, y: 100 } },
      { zone: 'tires', spot: { x: 70, y: 150 }, near: { x: 70, y: 190 } },
      { zone: 'appliances', spot: { x: 250, y: 110 }, near: { x: 250, y: 140 } },
    ]
    for (const sample of samples) {
      const layout = ZONE_LAYOUTS[sample.zone]
      if (!layout) throw new Error(`fixture is missing zone ${sample.zone}`)
      expect(
        canStand(blockers, layout.rect.x + sample.spot.x, layout.rect.y + sample.spot.y),
        `đứng trong vật ở ${sample.zone}`,
      ).toBe(false)
      expect(
        canStand(blockers, layout.rect.x + sample.near.x, layout.rect.y + sample.near.y),
        `đứng cạnh vật ở ${sample.zone}`,
      ).toBe(true)
    }
  })

  it('keeps the spawn and every gate mouth walkable', () => {
    // Bẫy có thật: `PLAYER_SPAWN` từng nằm ngay trong đế đống bao — walker đứng trong
    // hộp thì `slideMove` từ chối mọi bước và nhân vật chôn tại chỗ.
    expect(canStand(blockers, PLAYER_SPAWN.x, PLAYER_SPAWN.y), 'spawn').toBe(true)

    for (const [id, layout] of Object.entries(ZONE_LAYOUTS)) {
      for (const mouth of gateMouths(layout)) {
        expect(canStand(blockers, mouth.x, mouth.y), `${id} cổng ${mouth.x},${mouth.y}`).toBe(true)
      }
    }
  })

  it('walks out of every yard gate from the yard interior', () => {
    // Đế vật mới có thể vô tình vây kín một cổng (đống, tủ lạnh, chồng lốp xếp thành
    // tường). BFS 8 hướng bước 4px — đúng cỡ bước `slideMove` chia nhỏ — từ trong lòng
    // thửa ra tới mép ngoài của TỪNG cổng.
    for (const [id, layout] of Object.entries(ZONE_LAYOUTS)) {
      const mouths = gateMouths(layout)
      if (mouths.length === 0) continue
      const start = findStandable(blockers, {
        x: layout.rect.x + layout.rect.width / 2,
        y: layout.rect.y + layout.rect.height / 2,
      })
      expect(start, `${id} không có chỗ đứng nào quanh tâm`).not.toBe(null)
      if (!start) continue
      const reach = reachable(blockers, start, {
        x: layout.rect.x - 8,
        y: layout.rect.y - 8,
        width: layout.rect.width + 16,
        height: layout.rect.height + 16,
      })
      for (const mouth of mouths) {
        const near = [...reach].some((cell) => {
          const [x, y] = cell.split(',').map(Number)
          return Math.hypot((x ?? 0) - mouth.x, (y ?? 0) - mouth.y) <= STEP * 2
        })
        expect(near, `${id} bị vây kín, không ra được cổng ${mouth.x},${mouth.y}`).toBe(true)
      }
    }
  })

  it('runs every map trail through gates, never through a fence', () => {
    // Dải sỏi là đường NGƯỜI ĐI: vẽ xuyên vành là vẽ một lối đi không tồn tại. Điểm
    // cuối cố ý nằm đúng đường cổng (chỗ đã bị cắt khỏi đoạn rào) nên vẫn đứng được.
    const trails = SCRAP_MAP.trails ?? []
    expect(trails.length, 'bãi phải có lối đi nối các thửa').toBeGreaterThan(0)
    for (const trail of trails) {
      for (const branch of trail.branches) {
        for (let i = 0; i + 1 < branch.points.length; i++) {
          const from = branch.points[i]
          const to = branch.points[i + 1]
          if (!from || !to) continue
          const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4)
          for (let step = 0; step <= steps; step++) {
            const t = steps === 0 ? 0 : step / steps
            const x = from.x + (to.x - from.x) * t
            const y = from.y + (to.y - from.y) * t
            expect(canStand(blockers, x, y), `lối đi cắt vành ở ${Math.round(x)},${Math.round(y)}`).toBe(true)
          }
        }
      }
    }
  })

  it('treats raised clearings and solid prop bases as walls', () => {
    // Hill at 7600,2300 (elevation 2) — its edges are drawn as cliff walls.
    expect(canStand(blockers, 7690, 2360)).toBe(false)

    const solid = DECOR_PLACEMENTS.find((placement) => placement.key === 'tree0' || placement.key === 'tree1')
    const soft = DECOR_PLACEMENTS.find((placement) => placement.key === 'bush0' || placement.key === 'bush1')
    if (!solid || !soft) throw new Error('fixture is missing a tree or a bush')
    expect(canStand(blockers, solid.x, solid.y - 6)).toBe(false)
    // A bush is something you push through, not a wall.
    expect(canStand(blockers, soft.x, soft.y - 6)).toBe(true)
  })

  it('slides along a fence instead of stopping dead', () => {
    const from = { x: 3950, y: 2405 }
    // Diagonally into the south fence: sideways progress happens, straight-through
    // does not, and the walker never ends up standing inside the fence.
    const moved = slideMove(blockers, from, 2, 8)
    expect(moved.x).toBeGreaterThan(from.x)
    expect(moved.y).toBeLessThan(from.y + 8)
    expect(canStand(blockers, moved.x, moved.y)).toBe(true)
  })

  it('knows which yard the feet are in', () => {
    expect(zoneAt(PLAYER_SPAWN.x, PLAYER_SPAWN.y)).toBe('alley')
    expect(zoneAt(5120, 2880)).toBe('route')
    expect(zoneAt(100, 100)).toBe(null)
  })
})
