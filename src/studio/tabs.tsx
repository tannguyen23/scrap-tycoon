import { useEffect, useState, type ReactNode } from 'react'
import { sampleAmbient } from '@ui/scene/lighting'
import { PRIMARY_TERRAINS, type TileKind } from '@ui/scene/tiles/terrain'
import { StageCanvas } from './StageCanvas'
import {
  buildCharacters,
  buildDecor,
  buildEdgeSheet,
  buildLayout,
  buildLightingWorld,
  buildProps,
  buildScatter,
  buildScatterField,
  buildSeam,
  buildTiles,
  buildTraces,
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
        note="Sinh bằng code trong tiles/tileSet.ts. Mỗi loại nền có 4–8 biến thể tuỳ terrain; mép của mảng do bộ tile chuyển tiếp bên dưới đảm nhiệm."
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
        note="Mật độ lấy từ tiles/variety.ts (SCATTER_DENSITY_SCALE = 64px): ~30% map sạch hẳn, ~50% thưa/vừa, ~20% dày — chỗ dày thì cụm sỏi trong mảng đất cũng tụ vào, chỗ sạch thì paintBlob chỉ làm nhạt đất chứ không thêm rác. Muốn dày/thưa tổng thể thì chỉnh SCATTER_DENSITY_SCALE và các ngưỡng 0.18/0.55/0.85 trong TilePainter.scatter."
        build={buildScatterField}
      />
      <StageFrame
        caption="Dấu vết sử dụng trên nền đất (×2)"
        note="Các decal trong tiles/dirtDetail.ts được gọi bằng anchor thật của từng khu (piles/dropoff ở ngõ, pickup/dropoff ở kho, chỗ xe tải đỗ ở cổng) nên lối mòn luôn khớp nơi nhân công làm việc; vệt kéo bao + cụm sỏi + vũng nước chung do paintBlob rải cho mọi mảng đất."
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

export function CharactersTab() {
  return (
    <StageFrame
      caption="Nhân vật — mọi biến thể, đang bước tại chỗ"
      note="Dáng vuông vức kiểu voxel (đầu/mũ/tay/chân đều là khối chữ nhật, không bo tròn), góc nghiêng ¾: mặt + mũ, tay vung theo nhịp, chân bước; actor thật dùng chung sprite này qua actors.ts. Limb vẽ tại gốc và neo bằng .x; khối theo nắng trên-trái như decor (bóng tiếp xúc, giày tối, vai sáng – hông tối, đỉnh mũ sáng)."
      build={buildCharacters}
    />
  )
}

export function PropsTab() {
  return (
    <StageFrame
      caption="Props & xe — bánh xe quay thật"
      note="Bao tải/mảnh sắt/bánh nan hoa dùng chung từ parts.ts; xe ba gác và xe tải có state machine riêng ở actors.ts."
      build={buildProps}
    />
  )
}

const ZONE_PREVIEWS = [
  { id: 'alley', caption: 'Khu: Ngõ nhặt ve chai (×2)', scale: 2 },
  { id: 'route', caption: 'Khu: Đường ba gác chạy (×1)', scale: 1 },
  { id: 'depot', caption: 'Khu: Kho / cân hàng (×2)', scale: 2 },
  { id: 'gate', caption: 'Khu: Cổng ra vào (×2)', scale: 2 },
] as const

const ZONE_BUILDERS = ZONE_PREVIEWS.map((zone) => ({
  ...zone,
  build: buildZone(zone.id, zone.scale),
}))

export function ZonesTab() {
  return (
    <>
      {ZONE_BUILDERS.map((zone) => (
        <StageFrame
          key={zone.id}
          caption={zone.caption}
          note="Scene thật của game với state giả (3 nhân công, log10 ≥ 5) — nhân vật, prop, ambient life đều chạy."
          build={zone.build}
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

export function LayoutTab() {
  return (
    <StageFrame
      caption="Sơ đồ khu & các mối nối"
      note="Vùng đất 960×540. Xám = đường nối asphalt (2 driveway xuống kho/cổng + làn xuất bên phải cổng) — khai báo trong zoneLayout.CONNECTORS nên game và studio vẽ từ cùng một nguồn. Xanh = 4 ao nước trong zoneLayout.WATER_AREAS (vẽ bằng paintBlob('water') với đủ bờ autotile + bọt + lau sậy)."
      build={buildLayout}
    />
  )
}

const LIGHTING_WORLD = buildLightingWorld(18 / 24)

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