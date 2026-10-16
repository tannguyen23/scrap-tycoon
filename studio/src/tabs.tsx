import { useState, type ReactNode } from 'react'
import { validateGroundMap } from '@ground/core/grounds'
import { validateGroundPack } from '@ground/core/pack'
import { PRIMARY_TERRAINS, type TileKind } from '@ground/packs/scrapYard/terrains'
import { STUDIO_GROUND_PACKS } from './packs'
import { StageCanvas } from './StageCanvas'
import {
  buildEdgeSheet,
  buildPackWorld,
  buildScatter,
  buildScatterField,
  buildSeam,
  buildTiles,
  buildTraces,
} from './previews'
import type { StageBuilder, StageCell, StageScene } from './types'

/** Must match the padding of `.stage-wrap` in studio.css. */
const STAGE_PAD = 10

interface StageFrameProps {
  caption: string
  note?: string
  build: StageBuilder
  extra?: ReactNode
  onScene?: (scene: StageScene) => void
}

/**
 * Shared stage chrome: caption, note, optional controls, the canvas and the label
 * boxes the scene asked for. Kit tabs and project tabs both use it, so a project
 * tab looks exactly like a built-in one.
 */
export function StageFrame({ caption, note, build, extra, onScene }: StageFrameProps) {
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
        caption="Tileset — mọi loại nền × biến thể"
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

const packsTilesCache = new Map<string, StageBuilder>()
function packTilesFor(id: string): StageBuilder {
  let build = packsTilesCache.get(id)
  if (!build) {
    const entry = STUDIO_GROUND_PACKS.find((candidate) => candidate.id === id)
    build = entry ? (app) => buildTiles(app, entry.pack) : buildTiles
    packsTilesCache.set(id, build)
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
 * `studio/src/packs.ts` — game và studio dựng painter từ cùng pack đó.
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
          một dòng vào `studio/src/packs.ts`, không đụng gì trong `ground/core`.
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
          note="Map của pack, vẽ bằng đúng các pass của kit (nền → rải → làn → sàn → mảng → vết → đường nối → ao) theo từng CHUNK như game chạy: chỉ vùng đang nhìn được vẽ và giữ. Kéo để pan, lăn chuột để zoom (0.25×–2×) — đây chính là đường mà game đi."
          build={world}
        />
      ) : null}
    </>
  )
}
