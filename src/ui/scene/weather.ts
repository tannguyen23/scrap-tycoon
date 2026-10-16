import type { WeatherKindDef, WeatherProfile, WeatherVisual } from '@domain/types'
import { weatherVisualMix } from '@domain/weather'
import { playSound, sound } from '@ui/sound/player'
import { Container, Graphics } from 'pixi.js'
import { makeRandom } from './random'
import { WATER_AREAS, WORLD_HEIGHT, WORLD_WIDTH } from '@ground/packs/scrapYard/worldLayout'
import type { SceneWind } from '@scenery/core/ambience'
import { intersectsRect, type ViewRect } from '@scenery/core/view'

/** Mỗi "pixel" của mây vẽ trên lưới 2px cho ra dáng pixel-art chắc. */
const CLOUD_PIXEL = 2
/** Nắng ở trên-trái toàn game nên bóng mây lệch xuống-phải. */
const SUN_OFFSET = { x: 26, y: 16 }
const CLOUD_TONES = { light: 0xf4f1e8, mid: 0xd6d0c2, shade: 0xb2ac9e } as const
const CLOUD_SHADOW = 0x0a0e16
const RAIN_COLOR = 0xcfe0ef
const RAIN_COUNT = 90
const RAIN_FALL = 300
const RAIN_DRIFT = 70
const SPLASH_COUNT = 24
const RIPPLE_COUNT = 14
const GLOOM_COLOR = 0x2c3850
const WIND_DIRECTION = { x: 0.92, y: 0.2 }

interface CloudDef {
  x: number
  /** 0..1 — where the cloud band sits inside the visible height (view-anchored). */
  relY: number
  width: number
  height: number
  seed: number
  speed: number
  alpha: number
  shadowAlpha: number
}

/** Đội mây nền tảng: hai tầng độ cao (nhỏ/chậm/mờ ↔ lớn/nhanh/rõ hơn). */
const CLOUDS: readonly CloudDef[] = [
  { x: -80, relY: 0.144, width: 72, height: 26, seed: 11, speed: 6.2, alpha: 0.16, shadowAlpha: 0.05 },
  { x: 340, relY: 0.328, width: 104, height: 32, seed: 33, speed: 5.2, alpha: 0.13, shadowAlpha: 0.04 },
  { x: 720, relY: 0.208, width: 44, height: 20, seed: 55, speed: 7.4, alpha: 0.14, shadowAlpha: 0.045 },
  { x: 180, relY: 0.544, width: 88, height: 30, seed: 77, speed: 4.4, alpha: 0.11, shadowAlpha: 0.035 },
  { x: 640, relY: 0.653, width: 64, height: 24, seed: 99, speed: 5.6, alpha: 0.12, shadowAlpha: 0.04 },
  { x: 900, relY: 0.417, width: 50, height: 22, seed: 121, speed: 6.8, alpha: 0.13, shadowAlpha: 0.04 },
]

export interface CloudRun {
  x: number
  y: number
  width: number
  height: number
  tone: 'light' | 'mid' | 'shade'
}

/**
 * Sinh silhouette mây từ 1 base rộng + 3 bump, lượng tử hoá 2px, đáy phẳng —
 * thuần số học nên test được. Khe hở ≤ 1 ô (lỗ lượng tử giữa các blob) được gộp,
 * khía rộng hơn giữ nguyên để silhouette còn bông.
 */
export function cloudRuns(seed: number, width: number, height: number): CloudRun[] {
  const cols = Math.max(4, Math.round(width / CLOUD_PIXEL))
  const rows = Math.max(3, Math.round(height / CLOUD_PIXEL))
  let state = (seed * 2654435761) >>> 0 || 1
  const rnd = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  const blobs = [
    { cx: 0.5, cy: 0.84, rx: 0.5, ry: 0.24 },
    { cx: 0.22 + rnd() * 0.05, cy: 0.42, rx: 0.16, ry: 0.3 },
    { cx: 0.51 + rnd() * 0.05, cy: 0.3, rx: 0.19, ry: 0.34 },
    { cx: 0.79 - rnd() * 0.04, cy: 0.44, rx: 0.14, ry: 0.28 },
  ]
  const inside = (col: number, row: number): boolean => {
    const x = (col + 0.5) / cols
    const y = (row + 0.5) / rows
    if (y > 0.93) return false
    for (const blob of blobs) {
      const dx = (x - blob.cx) / blob.rx
      const dy = (y - blob.cy) / blob.ry
      if (dx * dx + dy * dy <= 1) return true
    }
    return false
  }

  const runs: CloudRun[] = []
  for (let row = 0; row < rows; row++) {
    const rowNorm = (row + 0.5) / rows
    const tone = rowNorm < 0.35 ? 'light' : rowNorm < 0.72 ? 'mid' : 'shade'
    const spans: Array<[number, number]> = []
    let start = -1
    for (let col = 0; col <= cols; col++) {
      const on = col < cols && inside(col, row)
      if (on && start < 0) start = col
      if (!on && start >= 0) {
        spans.push([start, col])
        start = -1
      }
    }
    for (let i = 1; i < spans.length; i++) {
      const prev = spans[i - 1]
      const cur = spans[i]
      if (prev && cur && cur[0] - prev[1] <= 1) {
        prev[1] = cur[1]
        spans.splice(i, 1)
        i -= 1
      }
    }
    for (const span of spans) {
      runs.push({
        x: span[0] * CLOUD_PIXEL,
        y: row * CLOUD_PIXEL,
        width: (span[1] - span[0]) * CLOUD_PIXEL,
        height: CLOUD_PIXEL,
        tone,
      })
    }
  }
  return runs
}

/** Trộn hai bộ tham số hình ảnh (mix 0..1) — UI tự ease trước khi gọi. */
export function mixWeatherVisual(from: WeatherVisual, to: WeatherVisual, mix: number): WeatherVisual {
  const k = Math.min(1, Math.max(0, mix))
  const lerp = (a: number, b: number): number => a + (b - a) * k
  return {
    cloudCover: lerp(from.cloudCover, to.cloudCover),
    rain: lerp(from.rain, to.rain),
    wind: lerp(from.wind, to.wind),
    lightning: lerp(from.lightning, to.lightning),
  }
}

/** Một điểm ngẫu nhiên nằm trong lòng các ao (đã co lề theo cỡ ao) — cho gợn mưa. */
export function pickPondSpot(rand: () => number, view?: ViewRect): { x: number; y: number } | null {
  // With a view, only the ponds on camera are candidates — off-screen rings would
  // just burn updates on a map with dozens of ponds.
  const ponds = view ? WATER_AREAS.filter((candidate) => intersectsRect(view, candidate.rect)) : WATER_AREAS
  const area = ponds[Math.floor(rand() * ponds.length)] ?? ponds[0]
  if (!area) return null
  const margin = Math.min(area.rect.width, area.rect.height) * 0.25
  return {
    x: area.rect.x + margin + rand() * Math.max(1, area.rect.width - margin * 2),
    y: area.rect.y + margin + rand() * Math.max(1, area.rect.height - margin * 2),
  }
}

interface Streak {
  node: Graphics
  factor: number
}

interface Splash {
  node: Graphics
  life: number
}

interface Ripple {
  node: Graphics
  life: number
}

export interface Weather {
  /** Mây + bóng + gloom + mưa + splash + gợn — đặt TRƯỚC `lighting.container` để ăn grade ngày/đêm. */
  readonly container: Container
  /** Chớp sét — đặt SAU `lighting.container` để không bị grade làm tối. */
  readonly flash: Container
  /**
   * `view` là rect thế giới đang hiện trên màn hình: quad grade, mây, mưa và
   * splash đều bám viewport, nên map to cỡ nào chi phí cũng theo màn hình.
   * Không truyền view (studio) thì giữ hành vi phủ toàn world cũ.
   */
  update(dt: number, playTimeS: number, view?: ViewRect): void
  wind(): SceneWind
  /** Studio: ghim một loại thời tiết (null = chạy lại theo lịch). */
  setOverride(kind: WeatherKindDef | null): void
  /** Studio/dev: chớp một cái ngay. */
  strike(): void
  dispose(): void
}

export interface WeatherOptions {
  profile: WeatherProfile
  /** Bật tiếng mưa/gió/sấm (tắt trong test/tool). */
  audio?: boolean
}

const SPLASH_LIFE = 0.22
const RIPPLE_LIFE = 0.9

function smoothstep(x: number): number {
  return x * x * (3 - 2 * x)
}

function flashAlpha(t: number): number {
  if (t < 0) return 0
  if (t < 0.06) return 0.85
  if (t < 0.12) return 0.1
  if (t < 0.2) return 0.6
  if (t < 0.5) return 0.6 * (1 - (t - 0.2) / 0.3)
  return 0
}

export function createWeather(options: WeatherOptions): Weather {
  const profile = options.profile
  const audio = options.audio ?? true
  const rng = makeRandom(0x5eed)

  const container = new Container()
  const cloudShadowLayer = new Container()
  const cloudLayer = new Container()
  const rainLayer = new Container()
  const splashLayer = new Container()
  const rippleLayer = new Container()
  const gloom = new Graphics()
  gloom.blendMode = 'multiply'
  gloom.alpha = 0
  container.addChild(cloudShadowLayer, cloudLayer, gloom, rainLayer, splashLayer, rippleLayer)

  const flash = new Container()
  const flashRect = new Graphics()
  flashRect.blendMode = 'add'
  flashRect.alpha = 0
  flash.addChild(flashRect)

  // Grade + flash quads cover the VIEW, not the world: with the map far bigger
  // than the canvas, a world-sized quad would be a full-map fill every frame.
  // Geometry is redrawn only when the view size changes; the position follows pan.
  let coverWidth = WORLD_WIDTH
  let coverHeight = WORLD_HEIGHT
  const drawCover = (): void => {
    gloom.clear().rect(0, 0, coverWidth, coverHeight).fill(GLOOM_COLOR)
    flashRect.clear().rect(0, 0, coverWidth, coverHeight).fill(0xffffff)
  }
  drawCover()
  const placeCover = (view?: ViewRect): void => {
    if (!view) {
      gloom.position.set(0, 0)
      flashRect.position.set(0, 0)
      return
    }
    if (view.width !== coverWidth || view.height !== coverHeight) {
      coverWidth = view.width
      coverHeight = view.height
      drawCover()
    }
    gloom.position.set(Math.round(view.x), Math.round(view.y))
    flashRect.position.set(Math.round(view.x), Math.round(view.y))
  }

  // ---- mây + bóng ghép cặp (bóng lệch theo nắng trên-trái) -------------------
  const clouds = CLOUDS.map((def) => {
    const runs = cloudRuns(def.seed, def.width, def.height)
    const shadow = new Graphics()
    const body = new Graphics()
    for (const run of runs) {
      shadow.rect(run.x, run.y, run.width, run.height).fill(CLOUD_SHADOW)
      body.rect(run.x, run.y, run.width, run.height).fill(CLOUD_TONES[run.tone])
    }
    shadow.position.set(def.x + SUN_OFFSET.x, def.relY * WORLD_HEIGHT + SUN_OFFSET.y)
    body.position.set(def.x, def.relY * WORLD_HEIGHT)
    cloudShadowLayer.addChild(shadow)
    cloudLayer.addChild(body)
    return { def, shadow, body, x: def.x }
  })

  // ---- pool mưa / splash / gợn ao --------------------------------------------
  const streaks: Streak[] = []
  for (let i = 0; i < RAIN_COUNT; i++) {
    const node = new Graphics().rect(0, 0, 1, 3).fill({ color: RAIN_COLOR, alpha: 0.45 })
    node.visible = false
    node.position.set(rng() * WORLD_WIDTH, rng() * WORLD_HEIGHT)
    rainLayer.addChild(node)
    streaks.push({ node, factor: 0.8 + rng() * 0.45 })
  }

  const splashes: Splash[] = []
  for (let i = 0; i < SPLASH_COUNT; i++) {
    const node = new Graphics()
    node.rect(0, 0, 4, 1).fill({ color: RAIN_COLOR, alpha: 0.55 })
    node.rect(-2, -2, 1, 1).fill({ color: RAIN_COLOR, alpha: 0.35 })
    node.rect(3, -3, 1, 1).fill({ color: RAIN_COLOR, alpha: 0.35 })
    node.visible = false
    splashLayer.addChild(node)
    splashes.push({ node, life: 0 })
  }

  const ripples: Ripple[] = []
  for (let i = 0; i < RIPPLE_COUNT; i++) {
    const node = new Graphics()
      .ellipse(0, 0, 6, 3)
      .stroke({ width: 0.8, color: RAIN_COLOR, alpha: 0.5 })
    node.visible = false
    rippleLayer.addChild(node)
    ripples.push({ node, life: 0 })
  }

  // ---- trạng thái thời gian thực ---------------------------------------------
  let elapsed = 0
  let current: WeatherVisual = { cloudCover: 0, rain: 0, wind: 0, lightning: 0 }
  let override: WeatherKindDef | null = null
  let flashTime = -1
  /** Đồng hồ riêng cho tiếng sấm (chớp có thể tắt trước khi sấm nổi). */
  let thunderCountdown = -1
  let striking = false
  let strikeTimer = 0
  let splashTimer = 0
  let rippleTimer = 0
  let audioTimer = 0
  const loopLevels = new Map<'rain' | 'wind', number>()

  const strike = (): void => {
    flashTime = 0
    thunderCountdown = 0.25 + rng() * 0.9
  }

  const pushLoop = (id: 'rain' | 'wind', level: number): void => {
    const clamped = Math.min(1, Math.max(0, level))
    const previous = loopLevels.get(id) ?? 0
    if (Math.abs(clamped - previous) < 0.05 && !(clamped === 0 && previous !== 0)) return
    loopLevels.set(id, clamped)
    if (audio) sound.setLoop(id, clamped)
  }

  const updateClouds = (dt: number, view?: ViewRect): void => {
    const cover = current.cloudCover
    const bandTop = view ? view.y : 0
    const bandHeight = view ? view.height : WORLD_HEIGHT
    const wrapLeft = view ? view.x - 280 : -280
    const wrapRight = view ? view.x + view.width + 120 : WORLD_WIDTH + 8
    for (const cloud of clouds) {
      cloud.x += (cloud.def.speed + current.wind * 16 * (cloud.def.height / 32)) * dt
      // Cloud lanes follow the camera: they enter from the far side of the view.
      if (cloud.x > wrapRight) cloud.x = view ? view.x - cloud.def.width - 60 : -cloud.def.width - 60
      else if (cloud.x < wrapLeft) cloud.x = view ? view.x + view.width + 40 : WORLD_WIDTH + 8
      const baseY = Math.round(bandTop + cloud.def.relY * bandHeight)
      cloud.body.position.set(Math.round(cloud.x), baseY)
      cloud.shadow.position.set(Math.round(cloud.x) + SUN_OFFSET.x, baseY + SUN_OFFSET.y)
      cloud.body.alpha = cloud.def.alpha * (0.3 + 1.2 * cover)
      cloud.shadow.alpha = cloud.def.shadowAlpha * (0.3 + 1.2 * cover)
    }
  }

  const updateRain = (dt: number, view?: ViewRect): void => {
    const intensity = current.rain
    const visibleCount = Math.round(RAIN_COUNT * Math.min(1, intensity * 1.2))
    const vx = current.wind * RAIN_DRIFT
    const angle = Math.atan2(vx, RAIN_FALL)
    const spanY = view ? view.height : WORLD_HEIGHT
    const spanX = view ? view.width : WORLD_WIDTH
    const originX = view ? view.x : 0
    const originY = view ? view.y : 0
    for (let i = 0; i < streaks.length; i++) {
      const streak = streaks[i]
      if (!streak) continue
      const on = i < visibleCount
      streak.node.visible = on
      if (!on) continue
      streak.node.rotation = angle
      const vy = RAIN_FALL * streak.factor
      streak.node.x += vx * streak.factor * dt
      streak.node.y += vy * dt
      // Streaks live inside the view band and recycle to its top / far side.
      if (streak.node.y > originY + spanY + 6) {
        streak.node.y -= spanY + 12
        streak.node.x = originX + rng() * (spanX + 24) - 12
      }
      if (streak.node.x > originX + spanX + 8) streak.node.x -= spanX + 16
      else if (streak.node.x < originX - 8) streak.node.x += spanX + 16
    }
  }

  const updateSplashes = (dt: number, view?: ViewRect): void => {
    const intensity = current.rain
    if (intensity > 0.08) {
      splashTimer -= dt
      if (splashTimer <= 0) {
        splashTimer = (0.5 + rng()) / (6 + 30 * intensity)
        const free = splashes.find((splash) => splash.life <= 0)
        if (free) {
          free.life = SPLASH_LIFE
          free.node.visible = true
          if (view) {
            free.node.position.set(
              Math.round(view.x + rng() * view.width),
              Math.round(view.y + 40 + rng() * Math.max(40, view.height - 80)),
            )
          } else {
            free.node.position.set(Math.round(rng() * WORLD_WIDTH), Math.round(40 + rng() * (WORLD_HEIGHT - 80)))
          }
        }
      }
    }
    for (const splash of splashes) {
      if (splash.life <= 0) continue
      splash.life -= dt
      if (splash.life <= 0) {
        splash.node.visible = false
        continue
      }
      splash.node.alpha = splash.life / SPLASH_LIFE
    }
  }

  const updateRipples = (dt: number, view?: ViewRect): void => {
    const intensity = current.rain
    if (intensity > 0.15) {
      rippleTimer -= dt
      if (rippleTimer <= 0) {
        rippleTimer = (0.4 + rng() * 0.9) / (0.5 + 2 * intensity)
        const free = ripples.find((ripple) => ripple.life <= 0)
        const spot = pickPondSpot(rng, view)
        if (free && spot) {
          free.life = RIPPLE_LIFE
          free.node.visible = true
          free.node.position.set(Math.round(spot.x), Math.round(spot.y))
        }
      }
    }
    for (const ripple of ripples) {
      if (ripple.life <= 0) continue
      ripple.life -= dt
      if (ripple.life <= 0) {
        ripple.node.visible = false
        continue
      }
      const q = 1 - ripple.life / RIPPLE_LIFE
      ripple.node.scale.set(0.35 + 1.1 * q, 0.35 + 1.1 * q)
      ripple.node.alpha = (1 - q) * 0.8
    }
  }

  const updateFlash = (dt: number): void => {
    if (flashTime >= 0) {
      flashTime += dt
      flashRect.alpha = flashAlpha(flashTime)
      if (flashTime > 0.6) {
        flashTime = -1
        flashRect.alpha = 0
      }
    }
    if (thunderCountdown >= 0) {
      thunderCountdown -= dt
      if (thunderCountdown < 0) {
        if (audio) playSound('thunder')
      }
    }
  }

  const updateStrikes = (dt: number): void => {
    // Chạy cả khi studio ghim một loại thời tiết — ghim "Bão" là thấy sét luôn.
    const rate = current.lightning
    if (rate <= 0.05) {
      striking = false
      return
    }
    if (!striking) {
      // Cơn bão "chào sân" bằng một chớp sớm thay vì đợi trọn chu kỳ.
      striking = true
      strikeTimer = 2 + rng() * 5
    }
    strikeTimer -= dt
    if (strikeTimer <= 0) {
      strike()
      strikeTimer = (profile.blockSeconds / Math.max(0.5, rate)) * (0.4 + rng() * 1.2)
    }
  }

  const updateAudio = (dt: number): void => {
    audioTimer -= dt
    if (audioTimer > 0) return
    audioTimer = 0.25
    pushLoop('rain', current.rain * 1.05)
    pushLoop('wind', current.wind / 1.6)
  }

  return {
    container,
    flash,
    update: (dt, playTimeS, view) => {
      elapsed += dt
      placeCover(view)
      if (override) {
        current = mixWeatherVisual(current, override.visual, 1 - Math.exp(-dt / 0.45))
      } else {
        const mix = weatherVisualMix(profile, playTimeS)
        if (mix) current = mixWeatherVisual(mix.from, mix.to, smoothstep(mix.mix))
      }
      gloom.alpha = 0.03 + 0.12 * current.rain
      updateClouds(dt, view)
      updateRain(dt, view)
      updateSplashes(dt, view)
      updateRipples(dt, view)
      updateFlash(dt)
      updateStrikes(dt)
      updateAudio(dt)
    },
    wind: () => {
      const gust =
        0.75 + 0.25 * Math.sin(elapsed * 0.6) + 0.15 * Math.sin(elapsed * 1.9 + 1.3) + 0.1 * Math.sin(elapsed * 4.1)
      const strength = Math.max(0, current.wind * gust)
      return { x: strength * WIND_DIRECTION.x, y: strength * WIND_DIRECTION.y, strength }
    },
    setOverride: (kind) => {
      override = kind
    },
    strike,
    dispose: () => {
      if (audio) {
        sound.setLoop('rain', 0)
        sound.setLoop('wind', 0)
      }
    },
  }
}
