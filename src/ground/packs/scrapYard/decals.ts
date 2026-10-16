import { makeRandom } from '@ground/core/random'
import type { GroundCanvas, Point } from '@ground/core/groundCanvas'

/**
 * Ground "usage traces": the decals that make a dirt clearing read as a place
 * where people actually work. Everything is declarative — callers pass the real
 * anchors (pile spots, drop-off, the burning barrel, the scale), so the wear
 * always lines up with where the actors walk.
 *
 * Drawing goes through `GroundCanvas` (satisfied by pixi's Graphics) so the
 * coordinates can be asserted in tests without a renderer.
 */

export interface TraceOptions {
  seed?: number
  /** 0..1 — how strong the trace reads. */
  strength?: number
}

const FOOTPRINT = 0x4a3b2a
const DUST = 0xa08a63
const DARK = 0x2f2418

/** Troden path: lighter packed dirt along the walk line, pebbles pushed aside. */
export function paintWearPath(g: GroundCanvas, path: readonly Point[], options: TraceOptions = {}): void {
  if (path.length < 2) return
  const rnd = makeRandom(options.seed ?? 991)
  const strength = options.strength ?? 1

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length < 2) continue
    const nx = -dy / length
    const ny = dx / length
    const steps = Math.max(1, Math.round(length / 5))

    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const wobble = (rnd() - 0.5) * 2
      const px = a.x + dx * t + nx * wobble
      const py = a.y + dy * t + ny * wobble
      g.ellipse(px, py, 5 + rnd() * 2, 3 + rnd() * 1.5).fill({ color: DUST, alpha: 0.1 * strength })
      g.ellipse(px + nx * 4, py + ny * 4, 3, 2).fill({ color: 0x5c4a34, alpha: 0.06 * strength })
      g.ellipse(px - nx * 4, py - ny * 4, 3, 2).fill({ color: 0x5c4a34, alpha: 0.06 * strength })
      if (rnd() < 0.35 * strength) {
        const side = rnd() < 0.5 ? 1 : -1
        const d = 5 + rnd() * 3
        g.rect(Math.round(px + nx * side * d), Math.round(py + ny * side * d), 1.5, 1).fill({
          color: rnd() < 0.5 ? 0x6a5738 : 0x95805e,
          alpha: 0.85,
        })
      }
    }
  }
}

/**
 * Nền bị GIẪM NÁT ở chỗ tụ người (điểm đổ, chỗ bốc hàng): một mảng đất nén loang ra chứ
 * không phải một đường. Chỗ nào mọi chuyến đều đổ về thì nền ở đó mòn thành vũng — vẽ
 * mỗi tuyến một vệt là ra **sơ đồ đường cho nhân vật đi theo**, không ra bãi thật.
 */
export function paintWearPatch(
  g: GroundCanvas,
  at: Point,
  options: TraceOptions & { radius?: number } = {},
): void {
  const rnd = makeRandom(options.seed ?? 992)
  const strength = options.strength ?? 1
  const radius = options.radius ?? 20

  for (let i = 0; i < 10; i++) {
    const angle = rnd() * Math.PI * 2
    const distance = rnd() * radius * 0.7
    const rx = radius * (0.4 + rnd() * 0.5)
    g.ellipse(at.x + Math.cos(angle) * distance, at.y + Math.sin(angle) * distance * 0.6, rx, rx * 0.5).fill({
      color: DUST,
      alpha: 0.05 * strength,
    })
  }
  // Mép phải RÁCH: vài vết cào ngắn quanh rìa + sỏi bị đẩy ra ngoài, không thì mảng mòn
  // đọc ra thành cái đĩa tròn dán lên nền.
  const scuffs = Math.max(3, Math.round(radius / 4))
  for (let i = 0; i < scuffs + 6; i++) {
    const angle = rnd() * Math.PI * 2
    const distance = radius * (i < scuffs ? 0.45 + rnd() * 0.35 : 0.8 + rnd() * 0.5)
    const x = Math.round(at.x + Math.cos(angle) * distance)
    const y = Math.round(at.y + Math.sin(angle) * distance * 0.6)
    if (i < scuffs) {
      g.rect(x, y, 2 + rnd() * 3, 1).fill({ color: 0x5c4a34, alpha: 0.08 * strength })
    } else {
      g.rect(x, y, 1.5, 1).fill({ color: rnd() < 0.5 ? 0x6a5738 : 0x95805e, alpha: 0.8 })
    }
  }
}

/** Alternating boot prints along a walk line (axis-aligned, so pixels stay crisp). */
export function paintFootprints(g: GroundCanvas, path: readonly Point[], options: TraceOptions = {}): void {
  const rnd = makeRandom(options.seed ?? 313)
  const strength = options.strength ?? 1
  let side = 1

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length < 6) continue
    const ux = dx / length
    const uy = dy / length
    const nx = -uy
    const ny = ux
    const steps = Math.max(1, Math.round(length / 7))
    const horizontal = Math.abs(ux) >= Math.abs(uy)

    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps
      const px = Math.round(a.x + dx * t + nx * side * 2.5 + (rnd() - 0.5) * 2)
      const py = Math.round(a.y + dy * t + ny * side * 2.5 + (rnd() - 0.5) * 2)
      side = -side
      if (horizontal) {
        g.rect(px, py, 3, 1).fill({ color: FOOTPRINT, alpha: 0.16 * strength })
        g.rect(px, py + 1, 2, 1).fill({ color: FOOTPRINT, alpha: 0.1 * strength })
      } else {
        g.rect(px, py, 1, 3).fill({ color: FOOTPRINT, alpha: 0.16 * strength })
        g.rect(px + 1, py, 1, 2).fill({ color: FOOTPRINT, alpha: 0.1 * strength })
      }
      if (rnd() < 0.4) {
        g.rect(px + (rnd() < 0.5 ? -1 : 2), py + 1, 1, 1).fill({ color: DUST, alpha: 0.18 * strength })
      }
    }
  }
}

/** Sack drag marks: two thin parallel lines with occasional cross scratches. */
export function paintDragMarks(g: GroundCanvas, path: readonly Point[], options: TraceOptions = {}): void {
  if (path.length < 2) return
  const rnd = makeRandom(options.seed ?? 517)
  const strength = options.strength ?? 1

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length < 4) continue
    const nx = -dy / length
    const ny = dx / length
    const steps = Math.max(1, Math.round(length / 2))

    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const px = a.x + dx * t
      const py = a.y + dy * t
      const wobble = (rnd() - 0.5) * 1.6
      g.rect(Math.round(px + nx * (1.5 + wobble)), Math.round(py + ny * (1.5 + wobble)), 1, 1).fill({
        color: FOOTPRINT,
        alpha: 0.14 * strength,
      })
      g.rect(Math.round(px - nx * (1.5 + wobble)), Math.round(py - ny * (1.5 + wobble)), 1, 1).fill({
        color: FOOTPRINT,
        alpha: 0.14 * strength,
      })
      if (s % 6 === 0) {
        for (let k = -2; k <= 2; k++) {
          g.rect(Math.round(px + nx * k * 0.8), Math.round(py + ny * k * 0.8), 1, 1).fill({
            color: DARK,
            alpha: 0.1 * strength,
          })
        }
      }
    }
  }
}

/** Wheelbarrow ruts: two dashed parallel lines with stones kicked into the middle. */
export function paintRuts(g: GroundCanvas, path: readonly Point[], options: TraceOptions = {}): void {
  if (path.length < 2) return
  const rnd = makeRandom(options.seed ?? 719)
  const strength = options.strength ?? 1

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length < 6) continue
    const nx = -dy / length
    const ny = dx / length
    const steps = Math.max(1, Math.round(length / 3))

    for (let s = 0; s <= steps; s++) {
      if ((s + i) % 4 >= 2) continue
      const t = s / steps
      const px = a.x + dx * t
      const py = a.y + dy * t
      for (const side of [1, -1]) {
        const rx = Math.round(px + nx * side * 3)
        const ry = Math.round(py + ny * side * 3)
        g.rect(rx, ry, 1, 1).fill({ color: DARK, alpha: 0.16 * strength })
        g.rect(rx, ry + 1, 1, 1).fill({ color: DARK, alpha: 0.1 * strength })
      }
      if (rnd() < 0.2) {
        g.rect(Math.round(px), Math.round(py), 1, 1).fill({ color: 0x95805e, alpha: 0.7 * strength })
      }
    }
  }
}

export interface StainOptions extends TraceOptions {
  radius?: number
  /** true = soot and ash (bright flecks), false = oil (glossy dark). */
  soot?: boolean
}

/** Soot / ash / oil spreading around a prop (burning barrel, scale, truck bay). */
export function paintStain(g: GroundCanvas, spot: Point, options: StainOptions = {}): void {
  const rnd = makeRandom(options.seed ?? 733)
  const radius = options.radius ?? 12
  const strength = options.strength ?? 1
  const color = options.soot ? 0x2b2320 : 0x241f19
  const blobs = 4 + Math.floor(rnd() * 3)

  for (let i = 0; i < blobs; i++) {
    const angle = rnd() * Math.PI * 2
    const dist = rnd() * radius * 0.7
    const rx = radius * (0.3 + rnd() * 0.35)
    g.ellipse(
      spot.x + Math.cos(angle) * dist,
      spot.y + Math.sin(angle) * dist * 0.6,
      rx,
      rx * (0.5 + rnd() * 0.3),
    ).fill({ color, alpha: (options.soot ? 0.14 : 0.16) * strength })
  }

  if (options.soot) {
    for (let i = 0; i < 10; i++) {
      const x = Math.round(spot.x + (rnd() - 0.5) * radius * 2)
      const y = Math.round(spot.y + (rnd() - 0.5) * radius)
      g.rect(x, y, 1, 1).fill({ color: 0xb0aaa0, alpha: 0.35 * strength })
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const x = Math.round(spot.x + (rnd() - 0.5) * radius)
      const y = Math.round(spot.y + (rnd() - 0.5) * radius * 0.6)
      g.rect(x, y, 1, 1).fill({ color: 0x6a6250, alpha: 0.3 * strength })
    }
  }
}

/** Small puddle resting in a dip: mud rim, two water tones, a light ripple. */
export function paintPuddle(g: GroundCanvas, x: number, y: number, rx: number, ry: number, seed = 7): void {
  const rnd = makeRandom(seed * 97 + 5)
  g.ellipse(x + 1, y + 1, rx + 2, ry + 1.5).fill({ color: 0x8a7550, alpha: 0.4 })
  g.ellipse(x, y, rx, ry).fill({ color: 0x5f82a8, alpha: 0.85 })
  g.ellipse(x, y - 0.5, rx * 0.6, ry * 0.55).fill({ color: 0x7aa0c4, alpha: 0.8 })
  g.rect(Math.round(x - rx * 0.5), Math.round(y - 1), 3, 1).fill({ color: 0xcfe4f5, alpha: 0.7 })
  if (rnd() < 0.6) {
    g.rect(Math.round(x + rx * 0.3), Math.round(y + 1), 2, 1).fill({ color: 0xcfe4f5, alpha: 0.5 })
  }
}