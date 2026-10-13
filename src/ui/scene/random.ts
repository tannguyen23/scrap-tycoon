/** Deterministic PRNG for scatter art — seeded so prop positions stay stable. */
export function makeRandom(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0 || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}
