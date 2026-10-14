import { useEffect, useRef, useState, type ReactNode } from 'react'
import { validateGroundMap } from '@ground/core/grounds'
import { validateGroundPack } from '@ground/core/pack'
import { sampleAmbient } from '@ui/scene/lighting'
import { PRIMARY_TERRAINS, type TileKind } from '@ground/packs/scrapYard/terrains'
import { SOUND_GROUPS, SOUND_GROUP_LABELS, SOUND_IDS, SOUND_LIBRARY } from '@ui/sound/library'
import { sound } from '@ui/sound/player'
import { DEFAULT_SOUND_SETTINGS } from '@ui/sound/settings'
import { STUDIO_GROUND_PACKS } from './packs'
import { StageCanvas } from './StageCanvas'
import {
  CHARACTER_CLIPS,
  CHARACTERS,
  STUDIO_WEATHER_KINDS,
  buildCharacters,
  buildDecor,
  buildEdgeSheet,
  buildLayout,
  buildLightingWorld,
  buildPackWorld,
  buildProps,
  buildScatter,
  buildScatterField,
  buildSeam,
  buildTiles,
  buildTraces,
  buildWeatherWorld,
  buildZone,
} from './previews'
import type { StageApi, StageBuilder, StageCell, StageScene } from './types'

/** Must match the padding of `.stage-wrap` in studio.css. */
const STAGE_PAD = 10

interface StageFrameProps {
  caption: string
  note?: string
  build: StageBuilder
  extra?: ReactNode
  onScene?: (scene: StageScene) => void
}

function StageFrame({ caption, note, build, extra, onScene }: StageFrameProps) {
  const [cells, setCells] = useState<readonly StageCell[]>([])

  return (
    <section className="studio-panel">
      <h3>{caption}</h3>
      {note ? <p className="studio-note">{note}</p> : null}
      {extra}
      <div className="stage-wrap">
        <StageCanvas
          build={build}
          onScene={(scene) => {
            setCells(scene.cells ?? [])
            onScene?.(scene)
          }}
        />
        {cells.map((cell) => (
          <span
            key={`${cell.label}:${cell.x}:${cell.y}`}
            className={`stage-label${cell.kind ? ` ${cell.kind}` : ''}`}
            style={{ left: cell.x + STAGE_PAD, top: cell.y + STAGE_PAD, width: cell.width }}
          >
            {cell.mask === undefined ? null : <MaskDiagram mask={cell.mask} />}
            {cell.label}
          </span>
        ))}
      </div>
    </section>
  )
}

/** 2×2 diagram of a corner mask, laid out like the bits (TL TR / BL BR). */
function MaskDiagram({ mask }: { mask: number }) {
  return (
    <span className="mask-grid" aria-hidden="true">
      <i className={mask & 1 ? 'on' : ''} />
      <i className={mask & 2 ? 'on' : ''} />
      <i className={mask & 8 ? 'on' : ''} />
      <i className={mask & 4 ? 'on' : ''} />
    </span>
  )
}

/**
 * Two dropdowns: what transitions into what. Builders are cached per pair so the
 * stage keeps a stable identity (and only the seen pairs get generated).
 */
function PairPicker({
  inside,
  outside,
  cliff,
  onChange,
  onCliffChange,
}: {
  inside: TileKind
  outside: TileKind
  /** Only the seam lab offers the raised-plateau view. */
  cliff?: boolean
  onChange: (inside: TileKind, outside: TileKind) => void
  onCliffChange?: (cliff: boolean) => void
}) {
  return (
    <div className="studio-switcher">
      <label>
        Trong:
        <select value={inside} onChange={(event) => onChange(event.target.value as TileKind, outside)}>
          {PRIMARY_TERRAINS.map((kind) => (
            <option key={`in-${kind}`} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      <button className="chip" onClick={() => onChange(outside, inside)} aria-label="Đảo trong/ngoài">
        ⇄
      </button>
      <label>
        Ngoài:
        <select value={outside} onChange={(event) => onChange(inside, event.target.value as TileKind)}>
          {PRIMARY_TERRAINS.map((kind) => (
            <option key={`out-${kind}`} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      {onCliffChange ? (
        <label className="studio-check">
          <input
            type="checkbox"
            checked={cliff ?? false}
            onChange={(event) => onCliffChange(event.target.checked)}
          />
          Vách (bậc cao)
        </label>
      ) : null}
      <span className="studio-note">
        {cliff ? 'chế độ vách: mép nam/đông thành tường + bóng đổ' : inside === outside ? 'cùng nền → mép thành gờ lõm' : 'cặp chuyển tiếp đang xem'}
      </span>
    </div>
  )
}

const edgeSheetCache = new Map<string, StageBuilder>()
function edgeSheetFor(inside: TileKind, outside: TileKind): StageBuilder {
  const key = `${inside}|${outside}`
  let build = edgeSheetCache.get(key)
  if (!build) {
    build = buildEdgeSheet(inside, outside)
    edgeSheetCache.set(key, build)
  }
  return build
}

const seamCache = new Map<string, StageBuilder>()
function seamFor(inside: TileKind, outside: TileKind, cliff: boolean): StageBuilder {
  const key = `${inside}|${outside}|${cliff ? 'cliff' : 'flat'}`
  let build = seamCache.get(key)
  if (!build) {
    // Seed from the pair so different sets never look identical.
    const seed = 501 + [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    build = buildSeam(inside, seed, outside, cliff)
    seamCache.set(key, build)
  }
  return build
}

const EDGE_SHEET_NOTE =
  'Bit: 1 = trên-trái, 2 = trên-phải, 4 = dưới-phải, 8 = dưới-trái — bit bật nghĩa là góc đó NẰM TRONG mảng. Đọc từ trên xuống theo 4 họ đường viền (một góc trong → hai góc kề → hai góc đối → khuyết một góc); mỗi case có 2 ô cạnh nhau = 2 biến thể. Dải trong cùng là viền tối + tông nền TRONG, dải ngoài là môi nền NGOÀI — đổi "Ngoài" sang dirt để thấy bờ bùn thay cho môi cỏ.'

export function TilesTab() {
  const [inside, setInside] = useState<TileKind>('dirt')
  const [outside, setOutside] = useState<TileKind>('grass')

  return (
    <>
      <StageFrame
        caption="Tileset — mọi loại nền × biến thể tông"
        note="Sinh bằng code: kit ở src/ground/core, asset ở pack của dự án. Mỗi loại nền có 4–8 biến thể tuỳ terrain; mép của mảng do bộ tile chuyển tiếp bên dưới đảm nhiệm."
        build={buildTiles}
      />
      <StageFrame
        caption={`Tile chuyển tiếp — ${inside} ↔ ${outside}`}
        note={EDGE_SHEET_NOTE}
        build={edgeSheetFor(inside, outside)}
        extra={
          <PairPicker
            inside={inside}
            outside={outside}
            onChange={(i, o) => {
              setInside(i)
              setOutside(o)
            }}
          />
        }
      />
    </>
  )
}

export function ScatterTab() {
  return (
    <>
      <StageFrame
        caption="Scatter — hoa/cỏ trên cỏ, sỏi/cành/lá trên đất, rác trôi trên nước"
        note="Ba lớp: flora chỉ mọc trên cỏ (vẽ trước blob), debris rải được cả trên đất, water chỉ nằm trong mặt nước (bị cắt theo đa giác ao). Số món mỗi ô và loại món do trường tần số thấp quyết định (xem khung dưới)."
        build={buildScatter}
      />
      <StageFrame
        caption="Trường mật độ scatter (seed 41 — lớp flora của map)"
        note="Mật độ lấy từ @ground/core/variety (SCATTER_DENSITY_SCALE = 64px): ~30% map sạch hẳn, ~50% thưa/vừa, ~20% dày — chỗ dày thì cụm sỏi trong mảng đất cũng tụ vào, chỗ sạch thì paintBlob chỉ làm nhạt đất chứ không thêm rác. Muốn dày/thưa tổng thể thì chỉnh SCATTER_DENSITY_SCALE và các ngưỡng 0.18/0.55/0.85 trong TilePainter.scatter."
        build={buildScatterField}
      />
      <StageFrame
        caption="Dấu vết sử dụng trên nền đất (×2)"
        note="Các decal trong pack (scrapYard/decals.ts) được gọi bằng anchor thật của từng khu (piles/dropoff ở khu ve chai, pickup/dropoff ở kho, chỗ xe tải đỗ ở cổng) nên lối mòn luôn khớp nơi nhân công làm việc; vệt kéo bao + cụm sỏi + vũng nước chung do paintBlob rải cho mọi mảng đất."
        build={buildTraces}
      />
    </>
  )
}

export function DecorTab() {
  return (
    <StageFrame
      caption="Decor — danh sách dọc, vẽ ở ×2"
      note="Mọi món dùng cùng công thức khối: bóng tiếp xúc dưới chân → viền tối nơi thân gặp đất → thân chia mặt tối/sáng → mặt sáng hướng trên-trái. Số cạnh tên là khung bao đã khai báo — test tự kiểm art có nằm trong khung đó. Thêm món mới = thêm drawer trong ui/scene/decorItems.ts (kèm khung bao) là studio tự liệt kê."
      build={buildDecor}
    />
  )
}

/** Builders are cached per combo so the stage only rebuilds when the pair changes. */
const charactersCache = new Map<string, StageBuilder>()
function charactersFor(characterId: string, clipId: string): StageBuilder {
  const key = `${characterId}|${clipId}`
  let build = charactersCache.get(key)
  if (!build) {
    build = buildCharacters(characterId, clipId)
    charactersCache.set(key, build)
  }
  return build
}

export function CharactersTab() {
  const [characterId, setCharacterId] = useState('ve-chai')
  const [clipId, setClipId] = useState('poke')
  const [facing, setFacing] = useState<1 | -1>(1)
  const [paused, setPaused] = useState(false)
  const [api, setApi] = useState<StageApi | null>(null)

  useEffect(() => {
    api?.setFacing?.(facing)
  }, [api, facing])

  useEffect(() => {
    api?.setPaused?.(paused)
  }, [api, paused])

  const character = CHARACTERS.find((entry) => entry.id === characterId)
  const clip = CHARACTER_CLIPS.find((entry) => entry.id === clipId)

  return (
    <StageFrame
      caption={`Nhân vật — ${character?.prefix ?? '?'} × ${clip?.label ?? '?'}`}
      note="Ghép tự do: chọn dáng rồi chọn hành động — đồ nghề thuộc về HÀNH ĐỘNG (WorkAction.items trong poses.ts), nên dáng nào cũng mặc được trọn bộ: 'chọt lon' tự gắn bịch nilong + cây chọt và lon bật vào bịch (đúng vòng lặp ngoài game ở alley/actors.ts); 'đi bộ'/'cúi nhặt' không mang đồ. 'Nhân vật trống' là body đầu trần không mũ để soi pose. Đổi lựa chọn là dựng lại stage; mỗi dáng hiện 3 biến thể A/B/C."
      build={charactersFor(characterId, clipId)}
      onScene={(scene) => setApi(scene.api ?? null)}
      extra={
        <div className="studio-controls">
          <label className="studio-clip-group">
            <span className="studio-clip-label">Nhân vật</span>
            <select value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
              {CHARACTERS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.prefix}
                </option>
              ))}
            </select>
          </label>
          <label className="studio-clip-group">
            <span className="studio-clip-label">Hành động</span>
            <select value={clipId} onChange={(event) => setClipId(event.target.value)}>
              {CHARACTER_CLIPS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="studio-check">
            <input
              type="checkbox"
              checked={facing === -1}
              onChange={(event) => setFacing(event.target.checked ? -1 : 1)}
            />
            Lật hướng (nhìn trái)
          </label>
          <label className="studio-check">
            <input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
            Tạm dừng
          </label>
        </div>
      }
    />
  )
}

export function PropsTab() {
  return (
    <StageFrame
      caption="Props & xe — bánh xe quay thật"
      note="Bao tải/mảnh sắt/bánh nan hoa dùng chung từ parts.ts. Mọi xe (route: ba gác → bán tải → xe tải thùng; cổng xuất: xe container) đều dựng đứng trên bánh theo góc nghiêng ¾ như nhân vật: mặt hông nam có sọc sơn/tôn sóng, nóc nhô, đuôi xe hơi lộ (cửa cuốn trên xe cổng), bánh far/near lệch nhau như hai chân."
      build={buildProps}
    />
  )
}

const ZONE_PREVIEWS = [
  { id: 'alley', caption: 'Khu: Ve chai (×2)', scale: 2 },
  { id: 'recycle', caption: 'Khu: Xưởng tái chế — đe & búa (×2)', scale: 2 },
  { id: 'route', caption: 'Khu: Tuyến xe chạy (×1)', scale: 1 },
  { id: 'depot', caption: 'Khu: Nơi đóng hàng (×2)', scale: 2 },
  { id: 'gate', caption: 'Khu: Cổng xuất (×2)', scale: 2 },
] as const

const ROUTE_TIERS = [
  { tier: 0, label: 'Ba gác' },
  { tier: 1, label: 'Xe bán tải' },
  { tier: 2, label: 'Xe tải thùng' },
] as const

const zoneCache = new Map<string, StageBuilder>()
function zoneFor(id: string, scale: number, tier: number): StageBuilder {
  const key = `${id}|${scale}|${tier}`
  let build = zoneCache.get(key)
  if (!build) {
    build = buildZone(id, scale, tier)
    zoneCache.set(key, build)
  }
  return build
}

export function ZonesTab() {
  const [routeTier, setRouteTier] = useState(0)
  const routeTierLabel = ROUTE_TIERS.find((entry) => entry.tier === routeTier)?.label ?? ''

  return (
    <>
      {ZONE_PREVIEWS.map((zone) => (
        <StageFrame
          key={zone.id}
          caption={zone.id === 'route' ? `${zone.caption} — ${routeTierLabel}` : zone.caption}
          note="Scene thật của game với state giả (3 nhân công, log10 ≥ 5) — nhân vật, prop, ambient life đều chạy. Bậc xe ở tuyến đúng bằng art khi mua nâng cấp 'Xe bán tải' / 'Xe tải thùng' trong game."
          build={zoneFor(zone.id, zone.scale, zone.id === 'route' ? routeTier : 0)}
          extra={
            zone.id === 'route' ? (
              <div className="studio-switcher">
                <label>
                  Bậc xe:
                  <select value={routeTier} onChange={(event) => setRouteTier(Number(event.target.value))}>
                    {ROUTE_TIERS.map((entry) => (
                      <option key={entry.tier} value={entry.tier}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : undefined
          }
        />
      ))}
    </>
  )
}

export function SeamsTab() {
  const [inside, setInside] = useState<TileKind>('dirt')
  const [outside, setOutside] = useState<TileKind>('grass')
  const [cliff, setCliff] = useState(false)

  return (
    <StageFrame
      caption={`Nối ${inside} ↔ ${outside}${cliff ? ' — có vách' : ''} ở ×3, có số mask từng ô`}
      note="Số trong ô mép = mask mà ô đó chọn (đối chiếu bảng tile cùng cặp ở tab Tileset). Bật 'Vách' để xem đúng kỹ thuật độ cao: gờ sáng trên mép + mặt tường có sọc + đường chân tối + bóng đổ xuống nền thấp (lệch phải vì nắng ở trên-trái); mép bắc/tây không có tường vì bị chính bậc cao che."
      build={seamFor(inside, outside, cliff)}
      extra={
        <PairPicker
          inside={inside}
          outside={outside}
          cliff={cliff}
          onChange={(i, o) => {
            setInside(i)
            setOutside(o)
          }}
          onCliffChange={setCliff}
        />
      }
    />
  )
}

const packTilesCache = new Map<string, StageBuilder>()
function packTilesFor(id: string): StageBuilder {
  let build = packTilesCache.get(id)
  if (!build) {
    const entry = STUDIO_GROUND_PACKS.find((candidate) => candidate.id === id)
    build = entry ? (app) => buildTiles(app, entry.pack) : buildTiles
    packTilesCache.set(id, build)
  }
  return build
}

const packWorldCache = new Map<string, StageBuilder>()
function packWorldFor(id: string): StageBuilder | null {
  const entry = STUDIO_GROUND_PACKS.find((candidate) => candidate.id === id)
  if (!entry?.map) return null
  let build = packWorldCache.get(id)
  if (!build) {
    build = buildPackWorld(entry.pack, entry.map)
    packWorldCache.set(id, build)
  }
  return build
}

/**
 * Hub đa dự án: chọn pack nền rồi xem chính kit vẽ nó. Kit ở `src/ground/core`
 * (depcruise cấm import pack/dự án), mỗi dự án một pack ở `src/ground/packs/<id>`
 * (terrain, specimen, decal, bờ nước, map). Thêm dự án = thêm một dòng vào
 * `studio/packs.ts` — game và studio dựng painter từ cùng pack đó.
 */
export function PacksTab() {
  const [packId, setPackId] = useState(STUDIO_GROUND_PACKS[0]?.id ?? '')
  const entry = STUDIO_GROUND_PACKS.find((candidate) => candidate.id === packId) ?? STUDIO_GROUND_PACKS[0]
  if (!entry) return null
  const errors = [
    ...validateGroundPack(entry.pack),
    ...(entry.map ? validateGroundMap(entry.pack, entry.map) : []),
  ]
  const world = packWorldFor(entry.id)

  return (
    <>
      <section className="studio-panel">
        <h3>Pack nền — hub đa dự án</h3>
        <p className="studio-note">
          Chọn một pack để xem đúng những gì kit dựng ra cho dự án đó: bảng tile (terrain × biến thể) và map
          riêng của pack, vẽ bằng chính `paintGrounds` mà game chạy. Thêm dự án mới = thêm một pack module +
          một dòng vào `studio/packs.ts`, không đụng gì trong `ground/core`.
        </p>
        <div className="studio-switcher">
          <label>
            Pack:
            <select value={entry.id} onChange={(event) => setPackId(event.target.value)}>
              {STUDIO_GROUND_PACKS.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>
          <span className="studio-note">{errors.length === 0 ? '✓ pack + map hợp lệ' : `✗ ${errors.join(' · ')}`}</span>
        </div>
      </section>
      <StageFrame
        caption={`Tileset — ${entry.label}`}
        note="Sinh bằng code từ pack đang chọn: palette là ramp sáng (bước liền kề ≤ 10/255, validateGroundPack khoá), kiểu vẽ ô do pack khai."
        build={packTilesFor(entry.id)}
      />
      {world ? (
        <StageFrame
          caption={`Map — ${entry.label} (${entry.map?.width ?? 0}×${entry.map?.height ?? 0})`}
          note="Map của pack, vẽ bằng đúng các pass của kit (nền → rải → làn → sàn → mảng → vết → đường nối → ao). Đây là đường mà game đi."
          build={world}
        />
      ) : null}
    </>
  )
}

export function LayoutTab() {
  return (
    <StageFrame
      caption="Sơ đồ khu & các mối nối"
      note="Vùng đất 1280×720. Xám = đường nối asphalt (2 driveway xuống kho/cổng + làn xuất bên phải cổng) — khai báo trong zoneLayout.CONNECTORS nên game và studio vẽ từ cùng một nguồn. Xanh = 4 ao nước trong zoneLayout.WATER_AREAS (vẽ bằng paintBlob('water') với đủ bờ autotile + bọt + lau sậy). Viền đậm = mảng có cao độ (nhãn 'cao độ N'). Xanh lá = tuyến courier đi bộ, vàng = tuyến xe — mỗi tuyến có điểm xuất phát + mũi tên chiều giao hàng, nhãn 'khu → khu · hàng'; bảng COURIER_RUNS trong ui/scene/couriers.ts là nơi DUY NHẤT quyết định cặp khu nào được nối."
      build={buildLayout}
    />
  )
}

const LIGHTING_WORLD = buildLightingWorld(18 / 24)
const WEATHER_WORLD = buildWeatherWorld(14 / 24)

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function formatHour(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function LightingTab() {
  const [hour, setHour] = useState(18)
  const [api, setApi] = useState<StageApi | null>(null)

  useEffect(() => {
    api?.setTime?.(hour / 24)
  }, [api, hour])

  const samples = [5, 8, 12, 18, 20, 23].map((h) => ({ hour: h, sample: sampleAmbient(h / 24) }))

  return (
    <StageFrame
      caption="Ánh sáng — grade màu theo giờ + quầng sáng đèn"
      note="Dùng chung module lighting.ts với game (chu kỳ 480s/ngày). Đèn: thùng phuy đốt, đèn kho, cửa sổ kho, chòi gác, đèn đường — sáng dần khi trời tối."
      build={LIGHTING_WORLD}
      extra={
        <div className="studio-controls">
          <label className="studio-slider">
            <span>
              Giờ trong ngày: <b>{formatHour(hour)}</b>
            </span>
            <input
              type="range"
              min={0}
              max={24}
              step={0.25}
              value={hour}
              onChange={(event) => setHour(Number(event.target.value))}
            />
          </label>
          <div className="studio-swatches">
            {samples.map(({ hour: h, sample }) => (
              <span key={h} className="studio-swatch">
                <i style={{ background: hex(sample.color), opacity: Math.max(0.15, sample.alpha) }} />
                {h}h
              </span>
            ))}
          </div>
        </div>
      }
      onScene={(scene) => setApi(scene.api ?? null)}
    />
  )
}

/** Khoảng cách giữa hai âm khi "Phát lần lượt" — đủ để nghe rõ từng âm. */
const SOUND_DEMO_STEP_MS = 450

export function SoundsTab() {
  const [volume, setVolume] = useState(DEFAULT_SOUND_SETTINGS.volume)
  const [muted, setMuted] = useState(DEFAULT_SOUND_SETTINGS.muted)
  const timers = useRef<number[]>([])

  useEffect(() => {
    sound.setMaster({ volume, muted })
  }, [volume, muted])

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer)
      timers.current = []
    },
    [],
  )

  const playAll = (): void => {
    for (const timer of timers.current) window.clearTimeout(timer)
    timers.current = SOUND_IDS.map((id, index) =>
      window.setTimeout(() => {
        sound.play(id)
      }, index * SOUND_DEMO_STEP_MS),
    )
  }

  return (
    <section className="studio-panel">
      <h3>Âm thanh — thư viện phát chung với game</h3>
      <p className="studio-note">
        Mọi âm thanh được tổng hợp bằng Web Audio trong ui/sound/library.ts — không có file âm thanh nào
        trong repo. Game và studio phát đúng cùng một thư viện. Trình duyệt chỉ mở khoá audio sau click đầu
        tiên (click này unlock, các click sau mới kêu); số trong tooltip là cooldown chống trùng của từng âm.
      </p>
      <div className="studio-controls">
        <label className="studio-slider">
          <span>
            Âm lượng tổng: <b>{Math.round(volume * 100)}%</b>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(volume * 100)}
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
          />
        </label>
        <label className="studio-check">
          <input type="checkbox" checked={muted} onChange={(event) => setMuted(event.target.checked)} />
          Tắt tiếng
        </label>
        <button className="chip" onClick={playAll}>
          Phát lần lượt ({SOUND_IDS.length})
        </button>
      </div>
      <div className="studio-sound-groups">
        {SOUND_GROUPS.map((group) => (
          <div key={group} className="studio-sound-group">
            <span className="studio-clip-label">{SOUND_GROUP_LABELS[group].vi}</span>
            <div className="studio-controls">
              {SOUND_IDS.filter((id) => SOUND_LIBRARY[id].group === group).map((id) => {
                const spec = SOUND_LIBRARY[id]
                return (
                  <button
                    key={id}
                    className="chip"
                    title={`${spec.description.vi} · cooldown ${spec.cooldownMs}ms`}
                    onClick={() => {
                      sound.play(id)
                    }}
                  >
                    {spec.label.vi}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function WeatherTab() {
  const [kindId, setKindId] = useState<string | null>('rain')
  const [hour, setHour] = useState(14)
  const [api, setApi] = useState<StageApi | null>(null)

  useEffect(() => {
    api?.setTime?.(hour / 24)
  }, [api, hour])

  useEffect(() => {
    api?.setWeather?.(kindId)
  }, [api, kindId])

  return (
    <StageFrame
      caption="Thời tiết — mây, mưa, gió, bão trên map thật"
      note="Dùng chung module ui/scene/weather.ts với game: mây + bóng ghép cặp lệch theo nắng trên-trái, gloom nhân màu, mưa nghiêng theo gió, splash + gợn mặt ao, chớp sét nằm sau grade ngày/đêm. 'Theo lịch' chạy nhanh ×8 để xem chuyển mùa; tiếng mưa/gió to dần theo cường độ, nút 'Chớp sét' phát cả sấm."
      build={WEATHER_WORLD}
      onScene={(scene) => setApi(scene.api ?? null)}
      extra={
        <div className="studio-controls">
          <label className="studio-clip-group">
            <span className="studio-clip-label">Thời tiết</span>
            <select
              value={kindId ?? 'schedule'}
              onChange={(event) => setKindId(event.target.value === 'schedule' ? null : event.target.value)}
            >
              <option value="schedule">Theo lịch (nhanh ×8)</option>
              {STUDIO_WEATHER_KINDS.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label.vi}
                </option>
              ))}
            </select>
          </label>
          <label className="studio-slider">
            <span>
              Giờ trong ngày: <b>{formatHour(hour)}</b>
            </span>
            <input
              type="range"
              min={0}
              max={24}
              step={0.25}
              value={hour}
              onChange={(event) => setHour(Number(event.target.value))}
            />
          </label>
          <button
            className="chip"
            onClick={() => {
              api?.strike?.()
            }}
          >
            Chớp sét
          </button>
        </div>
      }
    />
  )
}