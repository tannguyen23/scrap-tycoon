import { describe, it } from 'vitest'
import { TILE_SIZE } from '@ui/scene/tiles/terrain'
import { groundVariant, variantBoundaryBlend } from '@ui/scene/tiles/variety'

const WORLD_W = 1280
const WORLD_H = 720
const DITHER_MAX_DENSITY = 0.35

function budget(label: string, count: number, salt: number) {
  let tiles = 0
  let gated = 0
  let specks = 0
  let area = 0
  for (let y = 0; y < WORLD_H; y += TILE_SIZE) {
    for (let x = 0; x < WORLD_W; x += TILE_SIZE) {
      area++
      const own = groundVariant(x, y, count, salt)
      const touches =
        groundVariant(x - TILE_SIZE, y, count, salt) !== own ||
        groundVariant(x + TILE_SIZE, y, count, salt) !== own ||
        groundVariant(x, y - TILE_SIZE, count, salt) !== own ||
        groundVariant(x, y + TILE_SIZE, count, salt) !== own
      if (!touches) continue
      gated++
      const blend = variantBoundaryBlend(x, y, count, salt)
      if (!blend || blend.amount <= 0.05) continue
      tiles++
      specks += Math.round(TILE_SIZE * TILE_SIZE * DITHER_MAX_DENSITY * blend.amount)
    }
  }
  console.log(
    `  ${label.padEnd(10)} count=${count} salt=${String(salt).padEnd(3)} ` +
      `gated=${((gated / area) * 100).toFixed(1)}% of map  dithered=${((tiles / area) * 100).toFixed(1)}%  ` +
      `specks=${specks}  rects/tile=${(specks / Math.max(1, tiles)).toFixed(1)}`,
  )
}

function stats(label: string, count: number, salt: number) {
  let same = 0
  let total = 0
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const a = groundVariant(x * 16, y * 16, count, salt)
      if (a === groundVariant((x + 1) * 16, y * 16, count, salt)) same++
      if (a === groundVariant(x * 16, (y + 1) * 16, count, salt)) same++
      total += 2
    }
  }
  const runs: number[] = []
  let run = 1
  for (let x = 1; x < 512; x++) {
    if (groundVariant(x * 16, 128, count, salt) === groundVariant((x - 1) * 16, 128, count, salt)) run++
    else {
      runs.push(run)
      run = 1
    }
  }
  runs.push(run)
  console.log(
    `  ${label.padEnd(10)} agreement=${((same / total) * 100).toFixed(1)}%  meanRun=${(
      runs.reduce((a, b) => a + b, 0) / runs.length
    ).toFixed(2)}t`,
  )
}

describe('probe', () => {
  it('scores the field and the dither budget', () => {
    console.log('\n--- field ---')
    stats('grass', 6, 8)
    stats('dirt', 8, 13)
    stats('asphalt', 4, 20)
    stats('concrete', 4, 36)
    stats('TEST 8/7', 8, 7)

    console.log('\n--- dither budget over the whole map (3600 tiles) ---')
    budget('grass', 6, 8)
    budget('dirt(alley)', 8, 13)
    budget('dirt(lane)', 8, 14)
    budget('asphalt', 4, 20)
    budget('concrete', 4, 36)
  })
})
