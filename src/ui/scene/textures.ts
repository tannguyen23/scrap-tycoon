import { Container, Graphics } from 'pixi.js'

const BODY_COLORS = [0xe07a5f, 0x6c8ebf, 0x8fbf6c, 0xd9a05b]

/**
 * Placeholder pixel-art worker drawn from plain rects. When real art arrives,
 * this module is the only place that changes (generate textures + use Sprites).
 */
export function createWorkerSprite(variant: number): Container {
  const color = BODY_COLORS[variant % BODY_COLORS.length] ?? 0xe07a5f
  const sprite = new Container()

  const legs = new Graphics().rect(1, 6, 1, 2).rect(4, 6, 1, 2).fill(0x20222c)
  const body = new Graphics().rect(1, 2, 5, 4).fill(color)
  const head = new Graphics().rect(2, 0, 3, 3).fill(0xd9b38c)

  sprite.addChild(legs, body, head)
  return sprite
}

/** Scrap pile that grows with lifetime earnings (log scale, clamped). */
export function drawScrapPile(pile: Graphics, earnedLog10: number, groundY: number): void {
  pile.clear()
  const levels = Math.max(1, Math.min(10, Math.round(earnedLog10 * 1.5)))
  const centerX = 258
  for (let i = 0; i < levels; i++) {
    const width = 30 - i * 2
    if (width <= 4) break
    const y = groundY - 3 - i * 3
    pile.rect(Math.round(centerX - width / 2), y, width, 3).fill(i % 2 === 0 ? 0x6f7b8a : 0x59636f)
  }
}
