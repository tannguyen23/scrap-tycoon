/**
 * Minimal drawing surface shared by the ground-detail modules (traces, shore
 * dressing). Pixi's Graphics satisfies it structurally, and tests can pass a
 * recording stub, so decal coordinates are assertable without a renderer.
 */
export interface GroundCanvas {
  rect(x: number, y: number, width: number, height: number): GroundCanvas
  ellipse(x: number, y: number, radiusX: number, radiusY: number): GroundCanvas
  circle(x: number, y: number, radius: number): GroundCanvas
  /** Bare colour = opaque; the object form carries alpha. */
  fill(style: { color: number; alpha: number } | number): GroundCanvas
}

export interface Point {
  x: number
  y: number
}

export interface ContourStep {
  x: number
  y: number
  /** Unit vector pointing into the clearing. */
  inwardX: number
  inwardY: number
}

/** Walks a contour polygon and returns evenly spaced sample points. */
export function contourSteps(points: readonly number[], spacing: number): ContourStep[] {
  const count = points.length / 2
  if (count < 3) return []
  let cx = 0
  let cy = 0
  for (let i = 0; i < count; i++) {
    cx += points[i * 2] ?? 0
    cy += points[i * 2 + 1] ?? 0
  }
  cx /= count
  cy /= count

  const steps: ContourStep[] = []
  for (let i = 0; i < count; i++) {
    const ax = points[i * 2] ?? 0
    const ay = points[i * 2 + 1] ?? 0
    const bx = points[((i + 1) % count) * 2] ?? 0
    const by = points[((i + 1) % count) * 2 + 1] ?? 0
    const length = Math.hypot(bx - ax, by - ay)
    const parts = Math.max(1, Math.round(length / spacing))
    for (let s = 0; s < parts; s++) {
      const t = (s + 0.5) / parts
      const x = ax + (bx - ax) * t
      const y = ay + (by - ay) * t
      const dx = cx - x
      const dy = cy - y
      const len = Math.hypot(dx, dy) || 1
      steps.push({ x, y, inwardX: dx / len, inwardY: dy / len })
    }
  }
  return steps
}