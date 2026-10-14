import type { GroundMap } from '@ground/core/grounds'

/**
 * A tiny meadow site for the demo pack: parkland with a sandy pad, a trail lane,
 * two diggings, a boardwalk and a pond. Small on purpose — it exists so the kit
 * can be driven end-to-end by a project that shares no art with the scrap yard.
 */
export const MEADOW_MAP: GroundMap = {
  width: 640,
  height: 400,
  base: 'lawn',
  baseSeed: 3,
  patchworkSeed: 5,
  floraSeed: 7,
  lanes: [{ rect: { x: 40, y: 172, width: 560, height: 56 }, kind: 'trail', seed: 11, outside: 'lawn', jitter: 8 }],
  floors: [{ rect: { x: 96, y: 40, width: 176, height: 104 }, kind: 'sand', seed: 13, pad: 20 }],
  clearings: [
    { rect: { x: 430, y: 60, width: 130, height: 84 }, seed: 17, kind: 'sand' },
    { rect: { x: 250, y: 250, width: 96, height: 60 }, seed: 19, kind: 'trail' },
  ],
  traces: [
    { kind: 'wear', points: [{ x: 60, y: 200 }, { x: 580, y: 200 }], seed: 23, strength: 0.8 },
    { kind: 'footprints', points: [{ x: 80, y: 198 }, { x: 560, y: 202 }], seed: 29, strength: 0.9 },
  ],
  connectors: { rects: [{ x: 300, y: 300, width: 180, height: 24 }], kind: 'trail', seedBase: 31 },
  links: [
    {
      rect: { x: 500, y: 150, width: 44, height: 90 },
      kind: 'sand',
      seed: 37,
      outside: 'lawn',
      flare: 18,
      ramp: 24,
      jitter: 4,
    },
  ],
  debrisSeed: 41,
  water: [{ rect: { x: 470, y: 210, width: 110, height: 70 }, seed: 43, kind: 'pond' }],
}
