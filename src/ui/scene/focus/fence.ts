import { cornerHash } from '@ground/core/edgeGeometry'
import type { GroundCanvas } from '@ground/core/groundCanvas'
import {
  gateEdge,
  outlineEdgeOf,
  outlineRuns,
  rectFenceRuns,
  type FenceOpening,
  type FenceRun,
  type Point,
  type ZoneGate,
  type ZoneLayout,
} from '@ground/packs/scrapYard/worldLayout'

/**
 * Hàng rào bãi ghép tạm: từng tấm tôn gỉ hoặc ván gỗ mục khác cỡ, đóng lệch vào cọc
 * gỗ cao thấp so le — bãi nhặt đồ không ai dựng hàng rào thẳng tắp. Vật liệu và chiều
 * cao từng tấm chọn theo hash của chỉ số tấm nên mỗi cạnh mỗi khác mà vẫn tất định.
 * Chiều cao theo hướng vẫn cùng thang với `wallBands`: nam (gần người xem) cao nhất,
 * hai hông thấp hơn, bắc xa nhất thấp nhất. Lỗ mở khai ở `fenceOpenings` (khu rào
 * quanh rect) và `outline` + `gates` (khu có vành gấp khúc): `rectFenceRuns`/`outlineRuns`
 * cắt cổng ra thành
 * từng ĐOẠN rào, nên art vẽ đoạn nào thì `walkable` chặn đúng đoạn đó. Hai bên mỗi lỗ
 * mở là trụ cổng thép — chỗ duy nhất của hàng rào trông "được xây tử tế", còn lại là
 * đồ nhặt về đóng lại.
 */

const SECTION_MIN = 18
const SECTION_MAX = 30

/** Tông vật liệu: tôn mạ gỉ (xám lạnh) và ván gỗ mục (nâu ấm). */
const TIN = { body: 0x939caa, rib: 0x74818f, lit: 0xaab3c0, dark: 0x5f6874 }
const WOOD_TONES = [0x8a6c48, 0x7a5a34, 0x9c794f, 0x8a6242] as const
const WOOD_LIT = 0xa8874f
const WOOD_SEAM = 0x5c4426
const RUST = 0x8a5a34
const STAKE = { body: 0x7a5a34, lit: 0x9c794f, dark: 0x5c4426 }
const GATE_POST = 0xa4aab6
const GATE_CAP = 0xb4bac8

/** Chiều cao nền + biên độ so le của tấm theo cạnh, px. */
const PANELS = {
  north: { base: 6, vary: 2 },
  south: { base: 10, vary: 3.5 },
  west: { base: 8.5, vary: 2.5 },
  east: { base: 8.5, vary: 2.5 },
} as const

/** Trụ cổng: thép, cao hơn cọc — chốt hai bên lỗ mở. */
const GATE_HEIGHT = { north: 9.4, south: 15, east: 11, west: 11 } as const

/** Mỗi cạnh một muối hash riêng để bốn cạnh không ghép giống nhau. */
const EDGE_SALT = { north: 11, south: 23, west: 37, east: 53 } as const

type Edge = FenceOpening['edge']

/** 0..1 tất định từ chỉ số tấm. */
function roll(a: number, b: number, salt: number): number {
  return (cornerHash(a, b, salt) % 1000) / 1000
}

interface Section {
  /** Vị trí đầu/cuối đo dọc theo cạnh (x cho bắc/nam, y cho đông/tây). */
  start: number
  end: number
  index: number
}

interface PanelSpec {
  kind: 'tin' | 'wood' | 'lean'
  height: number
}

function panelSpec(edge: Edge, index: number): PanelSpec {
  const salt = EDGE_SALT[edge]
  const material = roll(index * 13 + 5, 7, salt)
  const kind: PanelSpec['kind'] = material < 0.16 ? 'lean' : material < 0.58 ? 'tin' : 'wood'
  const range = PANELS[edge]
  return { kind, height: range.base + roll(index * 29 + 3, 11, salt) * range.vary }
}

/** Chia một đoạn rào thành các tấm ghép bề ngang so le (18..30px). */
function sections(from: number, to: number, salt: number): Section[] {
  const out: Section[] = []
  let cursor = from
  let index = 0
  while (cursor < to - 0.5) {
    const span = to - cursor
    const width =
      span < SECTION_MIN
        ? span
        : Math.min(SECTION_MIN + roll(index * 5 + 1, 2, salt) * (SECTION_MAX - SECTION_MIN), span)
    out.push({ start: cursor, end: cursor + width, index })
    cursor += width
    index++
  }
  return out
}

/** Tấm tôn: gân dọc, mép trên hắt sáng, gỉ chảy từ vài chỗ. */
function drawTinPanel(g: GroundCanvas, section: Section, lineY: number, height: number, salt: number): void {
  const width = section.end - section.start
  g.rect(section.start, lineY - height, width, height).fill(TIN.body)
  for (let x = section.start + 1.8; x < section.end - 1; x += 3.2) {
    g.rect(x, lineY - height + 0.5, 0.9, height - 1.4).fill(TIN.rib)
  }
  g.rect(section.start, lineY - height, width, 0.8).fill(TIN.lit)
  g.rect(section.start, lineY - 1, width, 1).fill(TIN.dark)
  if (roll(section.index * 3, 13, salt) < 0.5) {
    g.rect(section.start + 2.4, lineY - height + 1, 2.6, 3.4).fill({ color: RUST, alpha: 0.8 })
    g.rect(section.start + 3.4, lineY - height + 4.4, 1, 3).fill({ color: RUST, alpha: 0.45 })
  } else {
    g.rect(section.end - 5.4, lineY - height + 2.2, 3.2, 1.6).fill({ color: RUST, alpha: 0.7 })
    g.rect(section.end - 4.2, lineY - height + 3.8, 1, 2.6).fill({ color: RUST, alpha: 0.4 })
  }
}

/** Tấm tôn gối nghiêng lên cọc bên phải: vẽ theo lát cắt, mỗi lát đẩy sang phải thêm chút. */
function drawLeaningPanel(g: GroundCanvas, section: Section, lineY: number, height: number): void {
  const width = section.end - section.start
  const lean = 4
  const slices = Math.max(3, Math.round(height / 2.8))
  const step = height / slices
  for (let i = 0; i < slices; i++) {
    // i = 0 là lát trên cùng: đỉnh ngả sang phải, đáy vẫn đứng ở mặt đất.
    const shift = ((slices - 1 - i) / (slices - 1)) * lean
    g.rect(section.start + shift, lineY - height + i * step, width - lean, step + 0.4).fill(TIN.body)
  }
  g.rect(section.start + lean, lineY - height - 0.4, width - lean, 0.8).fill(TIN.lit)
  g.rect(section.start, lineY - 1, width - lean, 1).fill(TIN.dark)
  // Gân dọc phải kẹp trong tấm: tấm nghiêng ở cuối cạnh mà vẽ gân theo offset cứng
  // thì gân thò ra ngoài khung rào (bắt được bằng test bound của hàng rào).
  for (const offset of [3, 7]) {
    const ribX = Math.min(section.start + lean / 2 + offset, section.end - 1.2)
    g.rect(ribX, lineY - height + 1.4, 0.9, height - 2.8).fill(TIN.rib)
  }
  g.rect(section.start + 1, lineY - 0.6, width - lean - 2, 1).fill({ color: 0x000000, alpha: 0.18 })
}

/** Ván gỗ: 2–3 tấm ván so le chiều cao, vân ngang + đinh. */
function drawWoodPanel(g: GroundCanvas, section: Section, lineY: number, height: number, salt: number): void {
  const planks = roll(section.index * 7, 13, salt) < 0.5 ? 2 : 3
  const gap = 0.8
  const total = section.end - section.start - gap * (planks - 1)
  let cursor = section.start
  for (let i = 0; i < planks; i++) {
    const width = i === planks - 1 ? section.end - cursor : total / planks
    const tone = WOOD_TONES[(section.index + i) % WOOD_TONES.length] ?? WOOD_TONES[0]
    const plankHeight = height - roll(section.index * 11 + i * 5, 17, salt) * 1.6
    g.rect(cursor, lineY - plankHeight, width, plankHeight).fill(tone)
    g.rect(cursor, lineY - plankHeight, width * 0.35, plankHeight).fill({ color: WOOD_LIT, alpha: 0.35 })
    g.rect(cursor, lineY - plankHeight, width, 0.7).fill({ color: 0x000000, alpha: 0.2 })
    g.rect(cursor + width - 0.9, lineY - plankHeight, 0.9, plankHeight).fill({ color: 0x000000, alpha: 0.18 })
    g.rect(cursor + width * 0.2, lineY - plankHeight + 2.6, width * 0.6, 0.7).fill({ color: WOOD_SEAM, alpha: 0.35 })
    g.rect(cursor + width * 0.45, lineY - plankHeight + 1.2, 1, 1).fill({ color: WOOD_SEAM, alpha: 0.85 })
    cursor += width + gap
  }
}

/** Cọc gỗ đóng đất: mặt tây hắt sáng, sườn đông tối, mặt cắt trên cùng sẫm. */
function stake(g: GroundCanvas, x: number, baseY: number, height: number, thick: number): void {
  g.rect(x - thick / 2, baseY - height, thick, height).fill(STAKE.body)
  g.rect(x - thick / 2, baseY - height, thick * 0.4, height).fill(STAKE.lit)
  g.rect(x + thick * 0.12, baseY - height, thick * 0.34, height).fill({ color: 0x000000, alpha: 0.16 })
  g.rect(x - thick / 2, baseY - height, thick, 0.9).fill(STAKE.dark)
}

function gatePost(g: GroundCanvas, x: number, baseY: number, height: number): void {
  g.rect(x - 1.7, baseY - height, 3.4, height).fill(GATE_POST)
  g.rect(x - 1.7, baseY - height, 1.3, height).fill({ color: 0xffffff, alpha: 0.18 })
  g.rect(x + 0.5, baseY - height, 1.2, height).fill({ color: 0x000000, alpha: 0.16 })
  g.rect(x - 2.1, baseY - height - 1.2, 4.2, 1.2).fill(GATE_CAP)
}

function horizontalRun(g: GroundCanvas, edge: 'north' | 'south', from: number, to: number, lineY: number): void {
  if (to - from < 2) return
  const salt = EDGE_SALT[edge]
  const panels = sections(from, to, salt)
  g.rect(from, lineY - 0.5, to - from, 1).fill({ color: 0x000000, alpha: 0.2 })
  for (const section of panels) {
    const spec = panelSpec(edge, section.index)
    // Tấm đóng lệch tay: mỗi tấm hạ/nhô nhẹ khỏi đường rào thay vì thẳng tắp.
    const line = lineY + (roll(section.index * 23, 29, salt) - 0.5) * 1.2
    if (spec.kind === 'lean') drawLeaningPanel(g, section, line, spec.height)
    else if (spec.kind === 'tin') drawTinPanel(g, section, line, spec.height, salt)
    else drawWoodPanel(g, section, line, spec.height, salt)
  }
  // Cọc chống ở ranh giới giữa hai tấm — hai đầu đoạn đã có trụ góc / trụ cổng.
  const cap = edge === 'south' ? 15 : 9.4
  for (let i = 1; i < panels.length; i++) {
    const current = panels[i]
    const previous = panels[i - 1]
    if (!current || !previous) continue
    const height =
      Math.max(panelSpec(edge, previous.index).height, panelSpec(edge, current.index).height) + 1.4
    stake(g, current.start, lineY, Math.min(cap, height), 2.8)
  }
}

function verticalRun(g: GroundCanvas, side: 'east' | 'west', from: number, to: number, lineX: number): void {
  if (to - from < 2) return
  const salt = EDGE_SALT[side]
  const inward = side === 'west' ? 1 : -1
  const panels = sections(from, to, salt)
  for (const section of panels) {
    const spec = panelSpec(side, section.index)
    const band = 2.5 + roll(section.index * 17, 19, salt) * 1.4
    // Dải hông cũng lệch ra/vào chút — hàng rào đóng tay không có đường chuẩn.
    const wobble = (roll(section.index * 23, 31, salt) - 0.5) * 0.8
    const start = lineX + inward * (0.2 + wobble)
    const x0 = inward === 1 ? start : start - band
    const length = section.end - section.start
    const wood = spec.kind === 'wood'
    const body = wood ? (WOOD_TONES[section.index % WOOD_TONES.length] ?? WOOD_TONES[0]) : TIN.body
    g.rect(x0, section.start, band, length).fill(body)
    const litX = side === 'west' ? x0 : x0 + band - 0.7
    g.rect(litX, section.start, 0.7, length).fill({ color: wood ? WOOD_LIT : TIN.lit, alpha: 0.75 })
    const darkX = side === 'west' ? x0 + band - 0.6 : x0
    g.rect(darkX, section.start, 0.6, length).fill({ color: 0x000000, alpha: 0.22 })
    if (!wood && section.index % 2 === 0) {
      g.rect(x0 + band * 0.45, section.start + 1.5, 0.7, length - 3).fill(TIN.rib)
    }
  }
  for (let i = 1; i < panels.length; i++) {
    const current = panels[i]
    const previous = panels[i - 1]
    if (!current || !previous) continue
    const height =
      Math.max(panelSpec(side, previous.index).height, panelSpec(side, current.index).height) + 1.4
    stake(g, lineX + inward * 1.7, current.start, Math.min(12.6, height), 2.8)
  }
  g.rect(lineX + inward * 3.6, from, 0.8, to - from).fill({ color: 0x000000, alpha: 0.18 })
}

const CORNER_NORTH = PANELS.north.base + PANELS.north.vary + 1.4
const CORNER_SOUTH = PANELS.south.base + PANELS.south.vary + 1.4

/** Một đoạn rào (đã trừ cổng) — mặt của nó quyết định dáng tấm. */
function drawRun(g: GroundCanvas, run: FenceRun): void {
  if (run.y1 === run.y2) {
    if (run.edge !== 'north' && run.edge !== 'south') return
    horizontalRun(g, run.edge, Math.min(run.x1, run.x2), Math.max(run.x1, run.x2), run.y1)
    return
  }
  if (run.edge !== 'east' && run.edge !== 'west') return
  verticalRun(g, run.edge, Math.min(run.y1, run.y2), Math.max(run.y1, run.y2), run.x1)
}

/** Vẽ hàng rào quanh khu trong TOẠ ĐỘ LOCAL của scene khu (gốc ở góc tây-bắc). */
export function drawZoneFence(
  g: GroundCanvas,
  size: { width: number; height: number },
  openings: readonly FenceOpening[] = [],
): void {
  for (const run of rectFenceRuns({ x: 0, y: 0, width: size.width, height: size.height }, openings)) {
    drawRun(g, run)
  }

  // Trụ góc: cọc gỗ dày hơn, cao hơn tấm một mẩu.
  stake(g, 0, 0, CORNER_NORTH, 3.2)
  stake(g, size.width, 0, CORNER_NORTH, 3.2)
  stake(g, 0, size.height, CORNER_SOUTH, 3.2)
  stake(g, size.width, size.height, CORNER_SOUTH, 3.2)

  for (const opening of openings) {
    if (opening.edge === 'north' || opening.edge === 'south') {
      const lineY = opening.edge === 'north' ? 0 : size.height
      for (const x of [opening.from, opening.to]) gatePost(g, x, lineY, GATE_HEIGHT[opening.edge])
    } else {
      const postX = opening.edge === 'west' ? 1.7 : size.width - 1.7
      for (const y of [opening.from, opening.to]) gatePost(g, postX, y, GATE_HEIGHT[opening.edge])
    }
  }
}

/** Mặt của hàng rào trong ¾ view: các đoạn nam là MẶT TIỀN, nằm trước lòng khu. */
export type FenceFace = 'back' | 'front'

function faceOf(edge: FenceRun['edge']): FenceFace {
  return edge === 'south' ? 'front' : 'back'
}

/** Góc nào dính đoạn mặt tiền thì cọc thuộc mặt tiền — nó phải che được actor. */
function cornerFace(outline: readonly Point[], index: number): FenceFace {
  const count = outline.length
  const here = outline[index]
  const before = outline[(index - 1 + count) % count]
  const after = outline[(index + 1) % count]
  if (!here || !before || !after) return 'back'
  return [outlineEdgeOf(before, here), outlineEdgeOf(here, after)].includes('south') ? 'front' : 'back'
}

/** Trụ cổng: hai mép khổ cổng, kẹp vào trong lòng khu như vành rect. */
function ringGatePosts(g: GroundCanvas, outline: readonly Point[], gates: readonly ZoneGate[], face: FenceFace): void {
  for (const gate of gates) {
    const edge = gateEdge(outline, gate)
    if (!edge || faceOf(edge) !== face) continue
    const half = gate.width / 2
    if (edge === 'north' || edge === 'south') {
      for (const x of [gate.at.x - half, gate.at.x + half]) gatePost(g, x, gate.at.y, GATE_HEIGHT[edge])
    } else {
      const postX = edge === 'west' ? gate.at.x + 1.7 : gate.at.x - 1.7
      for (const y of [gate.at.y - half, gate.at.y + half]) gatePost(g, postX, y, GATE_HEIGHT[edge])
    }
  }
}

/**
 * Vành của MỘT khu khai bằng `outline`, vẽ theo từng MẶT: scene gọi hai lần — mặt sau
 * (bắc + hai hông) vào node depth ở đường chân bắc, mặt tiền (các đoạn nam) vào node ở
 * đường chân nam — nên người chơi đứng trong khu được mặt tiền che, đứng ngoài thì che
 * nó. Khu không khai vành (rào quanh rect) vẽ bằng `drawZoneFence`.
 */
export function drawZoneRing(g: GroundCanvas, layout: ZoneLayout, face: FenceFace): void {
  const outline = layout.outline
  if (!outline || outline.length < 3) return
  const gates = layout.gates ?? []

  for (const run of outlineRuns(outline, gates)) {
    if (faceOf(run.edge) === face) drawRun(g, run)
  }
  outline.forEach((point, index) => {
    if (cornerFace(outline, index) !== face) return
    stake(g, point.x, point.y, face === 'front' ? CORNER_SOUTH : CORNER_NORTH, 3.2)
  })
  ringGatePosts(g, outline, gates, face)
}
