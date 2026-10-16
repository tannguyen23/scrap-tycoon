import type { ZoneId } from '@domain/types'
import type { TileKind } from './terrains'

/**
 * The scrap-yard world plan, as data: where the zones sit, and every patch, pond
 * and road link that dresses the ground between them. It lives in the pack — not
 * in the UI — because the pack is what paints the map; `ui` reads it back for the
 * camera, couriers and HUD, so a pack never reaches up into the game.
 *
 * The world is a **work world**: a compact industrial core (the five chain zones
 * plus the harvest fields around them) sits on a full-width avenue, and the rest
 * is wilderness — forests, ponds, a lake, plateaus — to explore. Zones keep their
 * authored size and their RELATIVE arrangement; growth goes into open ground.
 *
 * Design-space grid: the art is authored at double density (1 design px has
 * become the finest feature step), so the canvas maps 1:1 and every object
 * carries twice the pixels it used to.
 */
export const WORLD_WIDTH = 10240
export const WORLD_HEIGHT = 5760

/** The avenue (the old road band, now the map's spine): asphalt, full width. */
export const AVENUE_Y = 2848
export const AVENUE_HEIGHT = 64

export interface ZoneRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ZoneStyle {
  /** Pixi fill colour. */
  color: number
  /** Matching CSS colour for the HUD zone cards. */
  css: string
}

/** Lỗ mở trên hàng rào bao khu — chỗ làn xe/lối đi cắt qua một cạnh của khu. */
export interface FenceOpening {
  /** Cạnh của khu bị cắt qua. */
  edge: 'north' | 'east' | 'south' | 'west'
  /** Toạ độ LOCAL dọc theo cạnh (x cho cạnh bắc/nam, y cho cạnh đông/tây). */
  from: number
  to: number
}

/**
 * Một đoạn rào thẳng trục đã trừ cổng — nguồn CHUNG cho art lẫn va chạm, nên rào
 * vẽ ra sao thì chặn y như vậy.
 */
export interface FenceRun {
  /** Cạnh rào: quyết định chiều cao/tông tấm (nam cao nhất, bắc thấp nhất). */
  edge: 'north' | 'south' | 'west' | 'east'
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Point {
  x: number
  y: number
}

/** Cổng trên vành khu: điểm nằm TRÊN vành (thường là giữa khổ cổng) + khổ cổng, px. */
export interface ZoneGate {
  at: Point
  width: number
}

/** Đoạn rào của một đoạn vành khu: trục nào, mặt nào, còn lại từ đâu tới đâu. */
function outlineEdge(a: Point, b: Point): { axis: 'x' | 'y'; edge: FenceRun['edge']; line: number; from: number; to: number } | null {
  const edge = outlineEdgeOf(a, b)
  if (!edge) return null
  if (a.y === b.y) {
    return { axis: 'x', edge, line: a.y, from: Math.min(a.x, b.x), to: Math.max(a.x, b.x) }
  }
  return { axis: 'y', edge, line: a.x, from: Math.min(a.y, b.y), to: Math.max(a.y, b.y) }
}

/**
 * Mặt của một đoạn vành chuồng, suy từ HƯỚNG ĐI (vành khai theo chiều kim đồng hồ
 * từ góc tây-bắc): đi về đông = mặt bắc, xuống nam = hông đông, về tây = mặt nam,
 * lên bắc = hông tây. `null` khi đoạn không thẳng trục.
 */
export function outlineEdgeOf(a: Point, b: Point): FenceRun['edge'] | null {
  if (a.y === b.y && a.x !== b.x) return b.x > a.x ? 'north' : 'south'
  if (a.x === b.x && a.y !== b.y) return b.y > a.y ? 'east' : 'west'
  return null
}

function makeRun(axis: 'x' | 'y', edge: FenceRun['edge'], line: number, from: number, to: number): FenceRun {
  return axis === 'x'
    ? { edge, x1: from, y1: line, x2: to, y2: line }
    : { edge, x1: line, y1: from, x2: line, y2: to }
}

/** Cắt một đoạn rào thành các đoạn con sau khi trừ cổng (khổ cổng tính từ tâm). */
function cutGates(
  axis: 'x' | 'y',
  edge: FenceRun['edge'],
  line: number,
  from: number,
  to: number,
  gates: readonly { at: number; width: number }[],
): FenceRun[] {
  const cuts = gates
    .map((gate) => [gate.at - gate.width / 2, gate.at + gate.width / 2] as const)
    .filter(([a, b]) => b > from && a < to)
    .map(([a, b]) => [Math.max(a, from), Math.min(b, to)] as const)
    .sort((a, b) => a[0] - b[0])

  const out: FenceRun[] = []
  let cursor = from
  for (const [a, b] of cuts) {
    if (a > cursor) out.push(makeRun(axis, edge, line, cursor, a))
    cursor = Math.max(cursor, b)
  }
  if (cursor < to) out.push(makeRun(axis, edge, line, cursor, to))
  // Đoạn cụt dưới 2px chỉ là mẩu vụn giữa hai cổng sát nhau — không dựng tấm.
  return out.filter((run) => Math.abs(run.x2 - run.x1) + Math.abs(run.y2 - run.y1) >= 2)
}

/** Cổng nào nằm trên đoạn `a→b` (dùng cả cho cắt rào lẫn cho việc soi lỗi). */
function gateOn(a: Point, b: Point, gate: ZoneGate): boolean {
  if (a.y === b.y) {
    if (Math.abs(gate.at.y - a.y) > 1) return false
    const from = Math.min(a.x, b.x)
    const to = Math.max(a.x, b.x)
    return gate.at.x >= from - 1 && gate.at.x <= to + 1
  }
  if (a.x === b.x) {
    if (Math.abs(gate.at.x - a.x) > 1) return false
    const from = Math.min(a.y, b.y)
    const to = Math.max(a.y, b.y)
    return gate.at.y >= from - 1 && gate.at.y <= to + 1
  }
  return false
}

/** Cạnh của vành mà một cổng nằm trên — `null` nghĩa là cổng khai lạc ra ngoài vành. */
export function gateEdge(outline: readonly Point[], gate: ZoneGate): FenceRun['edge'] | null {
  const count = outline.length
  for (let i = 0; i < count; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % count]
    if (!a || !b) continue
    const style = outlineEdge(a, b)
    if (!style || !gateOn(a, b, gate)) continue
    return style.edge
  }
  return null
}

/** Các đoạn rào của một vành kín sau khi trừ cổng — toạ độ LOCAL của vành. */
export function outlineRuns(outline: readonly Point[], gates: readonly ZoneGate[] = []): FenceRun[] {
  const runs: FenceRun[] = []
  const count = outline.length
  for (let i = 0; i < count; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % count]
    if (!a || !b) continue
    const style = outlineEdge(a, b)
    if (!style) continue
    const cuts = gates
      .filter((gate) => gateOn(a, b, gate))
      .map((gate) => ({ at: style.axis === 'x' ? gate.at.x : gate.at.y, width: gate.width }))
    runs.push(...cutGates(style.axis, style.edge, style.line, style.from, style.to, cuts))
  }
  return runs
}

/** Hộp bao của một vành — dùng cho bất biến layout (vành nằm trong khu, khu không chồng nhau). */
export function outlineBounds(outline: readonly Point[]): ZoneRect {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of outline) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) }
}

/** Rào quanh một rect sau khi trừ `openings` (khổ cổng khai LOCAL dọc cạnh) — toạ độ của `rect`. */
export function rectFenceRuns(rect: ZoneRect, openings: readonly FenceOpening[] = []): FenceRun[] {
  const onEdge = (edge: FenceRun['edge'], base: number): { at: number; width: number }[] =>
    openings
      .filter((opening) => opening.edge === edge)
      .map((opening) => ({ at: base + opening.from + (opening.to - opening.from) / 2, width: opening.to - opening.from }))

  return [
    // Xa trước, gần sau: bắc → hai hông → nam.
    ...cutGates('x', 'north', rect.y, rect.x, rect.x + rect.width, onEdge('north', rect.x)),
    ...cutGates('y', 'west', rect.x, rect.y, rect.y + rect.height, onEdge('west', rect.y)),
    ...cutGates('y', 'east', rect.x + rect.width, rect.y, rect.y + rect.height, onEdge('east', rect.y)),
    ...cutGates('x', 'south', rect.y + rect.height, rect.x, rect.x + rect.width, onEdge('south', rect.x)),
  ]
}

/**
 * Đoạn rào của MỘT khu, toạ độ WORLD — nguồn chung cho art lẫn va chạm. Khu khai
 * `outline` thì vành là đường gấp khúc (cổng cắt từ `gates`); khu không khai thì rào
 * quanh rect, cổng cắt từ `fenceOpenings`. Khu không khai gì = không rào (dải đại lộ).
 */
export function zoneFenceRuns(layout: ZoneLayout): FenceRun[] {
  const { rect, outline, gates, fenceOpenings } = layout
  if (outline && outline.length >= 3) {
    return outlineRuns(outline, gates).map((run) => ({
      edge: run.edge,
      x1: rect.x + run.x1,
      y1: rect.y + run.y1,
      x2: rect.x + run.x2,
      y2: rect.y + run.y2,
    }))
  }
  return rectFenceRuns(rect, fenceOpenings)
}

export interface ZoneLayout {
  rect: ZoneRect
  style: ZoneStyle
  /**
   * Hàng rào quanh khu do chính scene chi tiết của khu vẽ (để cả map lẫn tab Khu
   * trong studio đều thấy). Khu khai `outline` thì rào là đường gấp khúc đó, cổng cắt
   * từ `gates`; khu không khai thì rào quanh rect, cổng cắt từ đây (LỖ MỞ khai LOCAL
   * dọc cạnh) — làn đất/làn nhựa cắt qua cạnh nào thì mở cổng đúng khổ làn đó. Khu
   * `route` là đường chạy ngang map nên không rào, không khai gì.
   */
  fenceOpenings?: readonly FenceOpening[]
  /**
   * Vành khu khi khu không phải cái hộp: đường gấp khúc THẲNG TRỤC (góc vuông) nối các
   * điểm, tự đóng vòng cuối→đầu, toạ độ LOCAL so với góc tây-bắc của `rect`. Đi VÒNG
   * THEO CHIỀU KIM ĐỒNG HỒ; hướng đi quyết định mặt sáng của từng đoạn: đi về đông =
   * mặt bắc (thấp nhất), xuống nam = hông đông (tối), về tây = mặt nam (mặt tiền, cao
   * nhất), lên bắc = hông tây (sáng) — đúng thang nắng trên-trái của game. Gấp khúc
   * (khuyết góc, chữ L, bậc thang) là thứ làm khu đọc ra CÁI BÃI chứ không phải cái hộp.
   */
  outline?: readonly Point[]
  /** Cổng trên vành — bắt buộc có khi khai `outline`, không thì khu thành cái hộp kín. */
  gates?: readonly ZoneGate[]
}

export const DEFAULT_ZONE_STYLE: ZoneStyle = { color: 0x8b93a7, css: '#8b93a7' }

/**
 * Map layout for the scrap-yard zones (design space). Keyed by the same zone
 * ids content uses; each zone's detail scene is authored for exactly this rect.
 * Zones keep their authored size and their RELATIVE arrangement (which lanes and
 * gates connect which edges) — the core simply moved onto the avenue. A zone may
 * carry an `outline` instead of a plain rect fence; the scrap yard is split into
 * three such plots (alley + tires + appliances) sharing the old footprint with
 * grass and trails between them.
 */
export const ZONE_LAYOUTS: Record<string, ZoneLayout> = {
  alley: {
    style: { color: 0x7cc45c, css: '#7cc45c' },
    // Bãi ve chai là BA THỬA ĐẤT RIÊNG, tách xa nhau (corridor cỏ ~300px, sỏi cong nối
    // chúng) — xem `tires` và `appliances`. Đây là thửa ĐÔNG-NAM: bãi LÀM VIỆC (đống
    // thợ chọt, điểm đổ bao, porter vác ra cổng đông). Giữ nguyên id và hai lối vào cũ
    // nên làn đất, courier, điểm spawn và toàn bộ gameplay đứng yên.
    // Thửa này BỊ GHIM: cạnh nam (y 2416) và cạnh đông (x 4240) là chỗ làn đất và lối
    // sang xưởng cắm vào — muốn tách ba thửa xa nhau thì dời `tires`/`appliances`.
    rect: { x: 3840, y: 2128, width: 400, height: 288 },
    // Vành méo: khuyết góc đông-nam (chỗ đó là sân cỏ). Cổng nam = làn đất xuống đại lộ
    // (world x 4062..4134), cổng đông = lối mòn sang xưởng (world y 2196..2244), cổng
    // tây mới thông ra corridor cỏ nối sang hai bãi kia.
    outline: [
      { x: 6, y: 6 },
      { x: 394, y: 6 },
      { x: 394, y: 224 },
      { x: 310, y: 224 },
      { x: 310, y: 282 },
      { x: 6, y: 282 },
    ],
    gates: [
      { at: { x: 258, y: 282 }, width: 72 },
      { at: { x: 394, y: 92 }, width: 48 },
      { at: { x: 6, y: 238 }, width: 56 },
    ],
  },
  tires: {
    style: { color: 0x6f7a8c, css: '#6f7a8c' },
    // Bãi lốp: thửa TÂY-BẮC, 11×22 ô — hẹp mà dài, khác hẳn hai thửa kia. Vành méo:
    // khuyết góc tây-nam. Cổng đông thông ra corridor cỏ.
    rect: { x: 3364, y: 1872, width: 176, height: 352 },
    outline: [
      { x: 6, y: 6 },
      { x: 170, y: 6 },
      { x: 170, y: 346 },
      { x: 96, y: 346 },
      { x: 96, y: 296 },
      { x: 6, y: 296 },
    ],
    gates: [{ at: { x: 170, y: 316 }, width: 48 }],
  },
  appliances: {
    style: { color: 0x9ad0e0, css: '#9ad0e0' },
    // Bãi đồ trắng: thửa BẮC-ĐÔNG, 25×10 ô — thấp mà dài. Vành méo: khuyết góc đông-nam.
    // Cổng nam thông xuống corridor cỏ.
    rect: { x: 3840, y: 1628, width: 400, height: 160 },
    outline: [
      { x: 6, y: 6 },
      { x: 394, y: 6 },
      { x: 394, y: 110 },
      { x: 310, y: 110 },
      { x: 310, y: 154 },
      { x: 6, y: 154 },
    ],
    gates: [{ at: { x: 110, y: 154 }, width: 60 }],
  },
  recycle: {
    style: { color: 0xd08a4a, css: '#d08a4a' },
    // Xưởng tái chế: 16.5×11 ô, đông-bắc lõi; làn nhựa nam của nó chạy thẳng xuống
    // đại lộ và đổ ĐÚNG chỗ chồng phôi của khu `route` (world x 5236).
    rect: { x: 5120, y: 2104, width: 264, height: 176 },
    fenceOpenings: [
      { edge: 'west', from: 92, to: 140 },
      { edge: 'south', from: 92, to: 140 },
    ],
  },
  route: {
    style: { color: 0xffb454, css: '#ffb454' },
    // Đại lộ chạy hết map; khu `route` là một ĐOẠN của nó quanh lõi, nơi chồng
    // phôi (local 724) ngồi ngay ngã ba làn xưởng đổ xuống.
    rect: { x: 4512, y: AVENUE_Y, width: 1280, height: AVENUE_HEIGHT },
  },
  depot: {
    style: { color: 0x7fa4d9, css: '#7fa4d9' },
    // Kho: nam-tây lõi, dưới bãi ve chai. Cổng kho: lối đi đất vào nhà cắt qua
    // cạnh bắc (world x 4052..4128); làn nhựa driveway nằm gọn trong lỗ mở đó.
    rect: { x: 3936, y: 3028, width: 264, height: 88 },
    fenceOpenings: [{ edge: 'north', from: 116, to: 192 }],
  },
  gate: {
    style: { color: 0xf08a6a, css: '#f08a6a' },
    // Cổng xuất: nam-đông lõi, sát đại lộ. Làn nhựa vào cổng ở cạnh bắc
    // (world x 6324..6360); làn xuất hàng ở cạnh đông (world y 3044..3080) rồi
    // chạy tiếp ra ngã ba nhập làn với đại lộ.
    rect: { x: 6260, y: 3016, width: 256, height: 92 },
    fenceOpenings: [
      { edge: 'north', from: 64, to: 100 },
      { edge: 'east', from: 28, to: 64 },
    ],
  },
}

export function zoneStyle(zoneId: ZoneId): ZoneStyle {
  return ZONE_LAYOUTS[zoneId]?.style ?? DEFAULT_ZONE_STYLE
}

/**
 * Lối đi giữa BA thửa của bãi ve chai (toạ độ world), kèm bề rộng từng dải. Đây là
 * địa lý của cả bãi — nằm cùng chỗ với zone/connector/ao để **decor và test đọc được
 * mà không phải chạm `worldGrounds`** (worldGrounds import decorPlacements, nên chiều
 * ngược lại là vòng import).
 *
 * Ngã ba phải là một CHỮ Y mượt, không phải hai dải cắm vào nhau thành góc: nhánh xuất
 * phát DỌC THEO TIM trục chính (nằm trọn trong dải trục nên mối nối không tồn tại) rồi
 * mới cong dần ra.
 */
export const TRAILS: readonly { points: readonly Point[]; width: number }[] = [
  // Trục chính: từ trong bãi làm việc → vòng qua corridor dọc → sang bãi đồ trắng.
  {
    points: [
      { x: 3878, y: 2366 },
      { x: 3846, y: 2366 },
      { x: 3796, y: 2352 },
      { x: 3758, y: 2328 },
      { x: 3732, y: 2294 },
      { x: 3720, y: 2254 },
      { x: 3718, y: 2212 },
      { x: 3722, y: 2170 },
      { x: 3730, y: 2128 },
      { x: 3744, y: 2086 },
      { x: 3762, y: 2044 },
      { x: 3786, y: 2006 },
      { x: 3816, y: 1974 },
      { x: 3852, y: 1950 },
      { x: 3890, y: 1930 },
      { x: 3922, y: 1898 },
      { x: 3940, y: 1858 },
      { x: 3950, y: 1820 },
      { x: 3950, y: 1782 },
      { x: 3950, y: 1746 },
    ],
    width: 34,
  },
  // Nhánh tây: rẽ vào cổng đông bãi lốp.
  {
    points: [
      { x: 3719, y: 2252 },
      { x: 3718, y: 2222 },
      { x: 3712, y: 2196 },
      { x: 3696, y: 2174 },
      { x: 3672, y: 2160 },
      { x: 3642, y: 2154 },
      { x: 3608, y: 2156 },
      { x: 3572, y: 2168 },
      { x: 3548, y: 2180 },
      { x: 3534, y: 2188 },
      { x: 3504, y: 2188 },
    ],
    width: 30,
  },
]

/** True khi (x, y) rơi vào một trong các rect — dùng cho vùng cấm của lớp rải random. */
export function insideAnyRect(rects: readonly ZoneRect[], x: number, y: number): boolean {
  for (const rect of rects) {
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return true
  }
  return false
}

/**
 * Asphalt links between zones (driveways up from the avenue, the forge lane and
 * the export lane east of the gate, plus the merge ramp back onto the avenue).
 * Painted from here so the map and the studio show the exact same connections.
 */
export const FORGE_LANE: ZoneRect = { x: 5212, y: 2280, width: 48, height: 568 }
export const DEPOT_DRIVEWAY: ZoneRect = { x: 4072, y: 2912, width: 36, height: 116 }
export const GATE_DRIVEWAY: ZoneRect = { x: 6324, y: 2912, width: 36, height: 104 }
export const GATE_EXIT_LANE: ZoneRect = { x: 6516, y: 3044, width: 680, height: 32 }
export const EXIT_MERGE_RAMP: ZoneRect = { x: 7164, y: 2912, width: 32, height: 132 }

export const CONNECTORS: readonly ZoneRect[] = [
  // Làn nhựa xưởng tái chế → đại lộ (world x 5212..5260), từ mép nam xưởng (2280)
  // xuống mặt đường (2848).
  FORGE_LANE,
  // Driveway kho: từ đại lộ (2912) xuống cổng bắc kho (3028).
  DEPOT_DRIVEWAY,
  // Driveway cổng xuất: từ đại lộ (2912) xuống cổng bắc cổng (3016).
  GATE_DRIVEWAY,
  // Làn xuất hàng: từ cổng đông (6516) chạy về đông tới ngã ba nhập làn.
  GATE_EXIT_LANE,
  // Ngã ba nhập làn: nối làn xuất hàng trở lên đại lộ (nơi xe tải "ra khỏi thành phố").
  EXIT_MERGE_RAMP,
]

export interface PatchArea {
  rect: ZoneRect
  /** Terrain of the patch (default dirt). */
  kind?: TileKind
  /** Terrain it sits in — drives the lip of its edge tiles (default grass). */
  outside?: TileKind
  /**
   * >0 makes the patch a raised plateau: its edges become walls (sunlit crest,
   * wall face with strata, shadow cast onto the lower ground). Visual only.
   */
  elevation?: number
}

/**
 * Ground patches on the open map. Around the core they are the **harvest fields**
 * (scrap fields, the gravel pit, the wallow host); away from it they are the
 * wilderness features (plateaus, forest floors, a lakeside bank). Elevation > 0
 * makes a plateau: its influence box must stay clear of every zone, connector and
 * courier path (see the layout test).
 */
export const CLEARINGS: readonly PatchArea[] = [
  // --- harvest fields around the core -----------------------------------------
  // Bãi phế liệu tây-bắc (điểm khai thác: đống ve chai rải trong bãi).
  { rect: { x: 3300, y: 1640, width: 300, height: 200 } },
  // Bãi phế liệu đông-bắc.
  { rect: { x: 6500, y: 1700, width: 300, height: 210 } },
  // Bãi phế liệu đông-nam.
  { rect: { x: 6300, y: 3450, width: 320, height: 230 } },
  // Mỏ sỏi: mảng đất có một mỏ sỏi nhô lên (demo cặp sỏi ↔ đất + bậc cao).
  { rect: { x: 3500, y: 3480, width: 300, height: 230 } },
  {
    rect: { x: 3650, y: 3580, width: 66, height: 40 },
    kind: 'gravel',
    outside: 'dirt',
    elevation: 1,
  },
  // Vũng bùn: ao bùn nằm trọn trong mảng đất (demo cặp nước ↔ đất).
  { rect: { x: 2000, y: 1400, width: 260, height: 190 } },
  // --- wilderness --------------------------------------------------------------
  // Gò đất cao giữa rừng tây.
  { rect: { x: 2500, y: 2200, width: 140, height: 90 }, elevation: 1 },
  // Đồi đá hai bậc ở đông bắc.
  { rect: { x: 7600, y: 2300, width: 180, height: 120 }, elevation: 2 },
  // Gò nam rừng.
  { rect: { x: 5200, y: 4300, width: 200, height: 140 }, elevation: 1 },
  // Bãi đất trống ven hồ tây.
  { rect: { x: 1500, y: 3700, width: 240, height: 170 } },
  // Nền rừng đông-nam.
  { rect: { x: 8500, y: 4200, width: 240, height: 180 } },
]

export interface WaterArea {
  rect: ZoneRect
  /**
   * Terrain the pond sits in — drives its shore: grass lip in the fields, packed
   * mud where a wallow is dug into dirt (the water↔dirt transition pair).
   */
  outside?: TileKind
}

/**
 * Standing water on the map: the west lake, ponds in the fields and forest, and
 * the mud wallow dug into its dirt patch. Painted as organic water blobs — full
 * autotile shore, foam, floating junk and water plants — not as flat ellipses.
 */
export const WATER_AREAS: readonly WaterArea[] = [
  // Hồ tây — vùng nước lớn nhất map.
  { rect: { x: 1200, y: 2950, width: 900, height: 560 } },
  // Ao bắc trong bãi cỏ.
  { rect: { x: 2600, y: 900, width: 220, height: 140 } },
  // Ao đông-bắc.
  { rect: { x: 6600, y: 800, width: 170, height: 110 } },
  // Ao đông trong rừng.
  { rect: { x: 8600, y: 1500, width: 200, height: 130 } },
  // Ao nam.
  { rect: { x: 4800, y: 4600, width: 240, height: 150 } },
  // Ao tây-nam.
  { rect: { x: 2800, y: 4300, width: 190, height: 120 } },
  // Hai ao nhỏ ngay bắc lõi (hồi nước cho khu ve chai/xưởng).
  { rect: { x: 4380, y: 1700, width: 150, height: 90 } },
  { rect: { x: 4760, y: 1620, width: 96, height: 64 } },
  // Vũng bùn trong mảng đất tây-bắc.
  { rect: { x: 2040, y: 1440, width: 130, height: 80 }, outside: 'dirt' },
]
