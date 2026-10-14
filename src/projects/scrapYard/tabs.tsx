import { useEffect, useRef, useState } from 'react'
import { sampleAmbient } from '@scenery/core/lighting'
import type { StageApi, StageBuilder } from '@studio/types'
import { StageFrame } from '@studio/tabs'
import { SOUND_GROUPS, SOUND_GROUP_LABELS, SOUND_IDS, SOUND_LIBRARY } from '@ui/sound/library'
import { sound } from '@ui/sound/player'
import { DEFAULT_SOUND_SETTINGS } from '@ui/sound/settings'
import {
  CHARACTER_CLIPS,
  CHARACTERS,
  STUDIO_WEATHER_KINDS,
  buildCharacters,
  buildDecor,
  buildLayout,
  buildLightingWorld,
  buildProps,
  buildWeatherWorld,
  buildZone,
} from './previews'

/** Builders are cached per combo so the stage only rebuilds when the choice changes. */
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

export function DecorTab() {
  return (
    <StageFrame
      caption="Decor — danh sách dọc, vẽ ở ×2"
      note="Mọi món dùng cùng công thức khối: bóng tiếp xúc dưới chân → viền tối nơi thân gặp đất → thân chia mặt tối/sáng → mặt sáng hướng trên-trái. Số cạnh tên là khung bao đã khai báo — test tự kiểm art có nằm trong khung đó. Thêm món mới = thêm drawer trong ui/scene/decorItems.ts (kèm khung bao) là studio tự liệt kê."
      build={buildDecor}
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
