import { Container, Graphics } from 'pixi.js'
import { makeRandom } from '../../random'
import { playSound } from '@ui/sound/player'
import { CALM_WIND, type SceneWind } from '@scenery/core/ambience'
import { Particles, SHADOW, smokePuff } from '../parts'
import type { Spot } from '@scene/core/types'

export interface AlleyLife {
  container: Container
  update(dt: number, elapsed: number, wind?: SceneWind): void
}

/**
 * Life riêng của bãi rác: thùng phuy cháy (khói + lửa hai frame), đàn ruồi bay qua
 * bay lại giữa các đám rác, một con chuột chạy giữa các đống và hai con hải âu
 * khoanh trên bãi.
 */
export function createAlleyLife(piles: Spot[], litter: Spot[] = []): AlleyLife {
  const container = new Container()
  const rnd = makeRandom(424242)

  const barrelX = 150
  const barrelY = 118

  const barrelArt = new Graphics()
  barrelArt.ellipse(barrelX + 1, barrelY + 4, 9, 6).fill(SHADOW)
  barrelArt.circle(barrelX, barrelY, 7).fill(0x5c6674)
  barrelArt.circle(barrelX, barrelY, 7).stroke({ width: 1, color: 0x454d59 })
  barrelArt.circle(barrelX, barrelY, 4.8).fill(0x2e333c)
  container.addChild(barrelArt)

  const glow = new Graphics().circle(barrelX, barrelY, 16).fill({ color: 0xffb454, alpha: 0.14 })
  container.addChild(glow)

  const flameA = new Graphics()
    .rect(barrelX - 3, barrelY - 3, 6, 6)
    .fill(0xff8a3d)
    .rect(barrelX - 1.5, barrelY - 1.5, 3, 3)
    .fill(0xffd27f)
  const flameB = new Graphics()
    .rect(barrelX - 2, barrelY - 4, 4, 7)
    .fill(0xff8a3d)
    .rect(barrelX - 1, barrelY - 2, 2, 3)
    .fill(0xffe6a8)
  flameB.visible = false
  container.addChild(flameA, flameB)

  // Hải âu: hai frame cánh lên/xuống, bay theo ellipse quanh bãi. Bay trên props nên
  // nó khoanh qua cả đống — đúng cảnh bãi rác.
  const gulls = [0, 1].map((index) => {
    const root = new Container()
    const up = new Graphics()
    const down = new Graphics()
    drawGull(up, true)
    drawGull(down, false)
    down.visible = false
    root.addChild(up, down)
    container.addChild(root)
    return {
      root,
      up,
      down,
      cx: 168,
      cy: 132 - index * 20,
      rx: 108 + index * 18,
      ry: 52 + index * 10,
      phase: rnd() * 6.28,
      speed: 0.2 + index * 0.07,
    }
  })

  // Ruồi bay qua bay lại giữa các đám rác: đống, thùng nhựa, bao vứt lẻ và thùng
  // phuy cháy — vùng rác càng rộng thì tụi nó càng rải khắp bãi thay vì quẩn một chỗ.
  const swarm = createFlySwarm([...piles, ...litter, { x: barrelX, y: barrelY }], 6)
  container.addChild(swarm.container)

  const rat = new Graphics()
    .ellipse(0, 0, 4, 2.2)
    .fill(0x4a4250)
    .rect(3.2, -0.8, 3.2, 1)
    .fill(0x4a4250)
    .circle(-2.2, -0.8, 1.4)
    .fill(0x5a5260)
  rat.visible = false
  container.addChild(rat)

  const particles = new Particles()
  container.addChild(particles.container)

  let smokeTimer = 0.3
  let cryTimer = 3 + rnd() * 6
  let ratTimer = 4 + rnd() * 6
  let ratX = 0
  let ratY = 0
  let ratTarget: Spot | null = null
  let ratDir: 1 | -1 = 1

  const update = (dt: number, elapsed: number, wind: SceneWind = CALM_WIND): void => {
    const frame = Math.floor(elapsed * 8) % 2
    flameA.visible = frame === 0
    flameB.visible = frame === 1
    glow.alpha = 0.1 + 0.06 * (0.5 + 0.5 * Math.sin(elapsed * 6))

    for (const gull of gulls) {
      gull.phase += dt * gull.speed * (1 + wind.strength * 0.5)
      const x = gull.cx + Math.cos(gull.phase) * gull.rx
      const y = gull.cy + Math.sin(gull.phase) * gull.ry
      gull.root.position.set(Math.round(x), Math.round(y))
      // Quay đầu theo chiều bay: đạo hàm của cos là -sin.
      gull.root.scale.x = -Math.sin(gull.phase) >= 0 ? 1 : -1
      const wingFrame = Math.floor(elapsed * 5 + gull.phase * 3) % 2
      gull.up.visible = wingFrame === 0
      gull.down.visible = wingFrame === 1
    }

    swarm.update(dt, elapsed)

    cryTimer -= dt
    if (cryTimer <= 0) {
      cryTimer = 7 + rnd() * 9
      playSound('gull')
    }

    smokeTimer -= dt
    if (smokeTimer <= 0) {
      smokeTimer = 0.55
      particles.spawn(smokePuff(), barrelX + 1, barrelY - 6, { vx: 1.6 + wind.x * 22, vy: -11, life: 1.3 })
    }
    particles.update(dt)

    if (ratTarget === null) {
      ratTimer -= dt
      if (ratTimer <= 0) {
        const from = piles[Math.floor(rnd() * piles.length)]
        const to = piles[Math.floor(rnd() * piles.length)]
        if (from && to && from !== to) {
          ratX = from.x
          ratY = from.y + 8
          ratTarget = { x: to.x, y: to.y + 8 }
          rat.visible = true
        }
      }
    } else {
      const dx = ratTarget.x - ratX
      if (Math.abs(dx) < 2) {
        rat.visible = false
        ratTarget = null
        ratTimer = 9 + rnd() * 9
      } else {
        ratDir = dx < 0 ? -1 : 1
        ratX += ratDir * 60 * dt
      }
      rat.scale.x = ratDir
      rat.position.set(Math.round(ratX), Math.round(ratY))
    }
  }

  return { container, update }
}

/**
 * Mòng biển ¾ nhìn từ trên: hai cánh là hai nét ngang, thân và mỏ nhỏ ở giữa. Frame
 * `wingsUp` nhấc hai cánh lên, frame kia hạ xuống — ở cỡ ~10px chỉ cần thế là đủ đọc.
 */
function drawGull(g: Graphics, wingsUp: boolean): void {
  const wing = wingsUp ? -3 : 2
  g.rect(-5, wing, 4, 1).fill(0xeef1f5)
  g.rect(1, wing, 4, 1).fill(0xeef1f5)
  g.rect(-2, -1.5, 5, 3).fill(0xf6f8fa)
  g.rect(-2, 0.8, 3, 1).fill(0xcfd6de)
  g.rect(2.6, -1, 1.8, 1).fill(0xe4a13c)
}

export interface FlySwarm {
  container: Container
  update(dt: number, elapsed: number): void
}

interface Fly {
  root: Container
  wings: Graphics
  x: number
  y: number
  targetX: number
  targetY: number
  anchor: Spot
  phase: number
  speed: number
  rest: number
}

/**
 * Ruồi bay qua bay lại giữa các đám rác: mỗi con đậu hờ quanh một đám (lượn tại chỗ
 * vài phần giây), rồi kéo thẳng sang đám khác — chặng bay nối hai đám là thứ mắt bắt
 * được, còn lúc lượn thì dao động vuông góc + nhịp cánh hai frame tạo tiếng vo ve.
 */
export function createFlySwarm(anchors: Spot[], count: number): FlySwarm {
  const container = new Container()
  const rnd = makeRandom(70707)
  const flies: Fly[] = []

  const offset = (): { x: number; y: number } => ({ x: rnd() * 16 - 8, y: rnd() * 9 - 6 })
  const retarget = (fly: Fly): void => {
    if (rnd() < 0.4) {
      fly.anchor = anchors[Math.floor(rnd() * anchors.length)] ?? fly.anchor
    }
    const spot = offset()
    fly.targetX = fly.anchor.x + spot.x
    fly.targetY = fly.anchor.y + spot.y
    fly.rest = 0.5 + rnd() * 1.6
  }

  for (let i = 0; i < count; i++) {
    const anchor = anchors[i % Math.max(1, anchors.length)] ?? { x: 120, y: 120 }
    const root = new Container()
    const wings = new Graphics().rect(-2.8, -2.1, 5.6, 1.1).fill({ color: 0x8a8177, alpha: 0.7 })
    const body = new Graphics().rect(-1.2, -1, 2.4, 2).fill(0x2b2320)
    wings.visible = false
    root.addChild(wings, body)
    const spot = offset()
    const fly: Fly = {
      root,
      wings,
      x: anchor.x + spot.x,
      y: anchor.y + spot.y,
      targetX: 0,
      targetY: 0,
      anchor,
      phase: rnd() * 6.28,
      speed: 20 + rnd() * 12,
      rest: rnd() * 1.5,
    }
    retarget(fly)
    root.position.set(Math.round(fly.x), Math.round(fly.y))
    container.addChild(root)
    flies.push(fly)
  }

  const update = (dt: number, elapsed: number): void => {
    for (const fly of flies) {
      const dx = fly.targetX - fly.x
      const dy = fly.targetY - fly.y
      const dist = Math.hypot(dx, dy)
      if (dist < 3) {
        fly.rest -= dt
        if (fly.rest <= 0) retarget(fly)
      } else {
        const step = Math.min(dist, fly.speed * dt)
        const wobble = Math.sin(elapsed * 21 + fly.phase) * 7
        fly.x += (dx / dist) * step + (-dy / dist) * wobble * dt
        fly.y += (dy / dist) * step + (dx / dist) * wobble * dt
      }
      fly.root.position.set(Math.round(fly.x), Math.round(fly.y))
      fly.wings.visible = Math.floor(elapsed * 16 + fly.phase * 4) % 2 === 0
    }
  }

  return { container, update }
}
