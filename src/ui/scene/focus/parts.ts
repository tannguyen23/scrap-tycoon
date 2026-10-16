import { Container, Graphics } from 'pixi.js'

export const SHADOW = { color: 0x000000, alpha: 0.18 } as const

/** Detailed gunnysack with tie and wrinkles (origin = top-left). */
export function createSack(scale = 1): Container {
  const sack = new Container()
  // Bậc sáng: mặt nam xám ngà, DẢI TRÊN phải SÁNG HƠN (mặt trên > mặt nam).
  const body = new Graphics().rect(0, 1, 10, 8).fill(0xe0c79c)
  const top = new Graphics().rect(1, 0, 8, 3).fill(0xf2e0bd)
  const tie = new Graphics().rect(3, 0, 4, 1).fill(0xa3804f)
  const wrinkle = new Graphics().rect(2, 5, 6, 1).fill({ color: 0xb08a5e, alpha: 0.6 })
  sack.addChild(body, top, tie, wrinkle)
  sack.scale.set(scale)
  return sack
}

/** Shipping crate, block-recipe shaded (origin = top-left of the south face). */
export function createCrateBox(scale = 1): Container {
  const crate = new Container()
  const box = new Graphics().rect(0, 0, 11, 8.5).fill(0x9c7448)
  box.rect(0, 0, 11, 1.3).fill(0xb98d52)
  box.rect(0, 7.5, 11, 1).fill(0x5c4426)
  box.rect(5, 0, 1, 8.5).fill(0x5c4426)
  box.rect(0, 3.3, 11, 0.8).fill(0x5c4426)
  box.rect(0, 0, 11, 8.5).stroke({ width: 0.5, color: 0x5c4426, alpha: 0.55 })
  crate.addChild(box)
  crate.scale.set(scale)
  return crate
}

/** Billet bars strapped on a pallet — the cart load (origin = bottom-left). */
export function createPalletLoad(scale = 1): Container {
  const load = new Container()
  const deck = new Graphics()
  deck.rect(0, -2.4, 18, 2.4).fill(0x9c7448)
  deck.rect(0, -2.4, 18, 0.8).fill(0xb98d52)
  deck.rect(2, 0, 3, 1.2).fill(0x8b939c)
  deck.rect(8, 0, 3, 1.2).fill(0x8b939c)
  deck.rect(14, 0, 3, 1.2).fill(0x8b939c)
  const bars = new Graphics()
  bars.rect(1, -6.4, 16, 4).fill(0x8b939c)
  bars.rect(1, -6.4, 16, 1.4).fill(0xdfe6ec)
  bars.rect(1, -4, 16, 0.7).fill({ color: 0x000000, alpha: 0.18 })
  const hotEnd = new Graphics().rect(14.4, -6.6, 2.4, 4.4).fill({ color: 0xffb45a, alpha: 0.85 })
  load.addChild(deck, bars, hotEnd)
  load.scale.set(scale)
  return load
}

/** Fine-grained scrap bit: bolts, plates, wire clippings. */
export function createScrapBit(kind: number): Graphics {
  const colors = [0x9aa8b6, 0x8492a0, 0xb08a55, 0x8a97a6]
  const color = colors[kind % colors.length] ?? 0x9aa8b6
  const g = new Graphics()
  if (kind % 2 === 0) {
    g.rect(0, 0, 4, 2).fill(color)
    g.rect(1, 2, 2, 1).fill({ color, alpha: 0.8 })
  } else {
    g.rect(0, 0, 2, 2).fill(color)
    g.rect(2, 1, 3, 1).fill({ color, alpha: 0.8 })
  }
  return g
}

export interface SpokeWheel {
  container: Container
  /** Toggles spokes in two frames while rolling. */
  spin(speed: number, dt: number): void
}

export function createSpokeWheel(radius: number): SpokeWheel {
  const container = new Container()
  const rim = new Graphics().circle(radius, radius, radius).fill(0x1f2126)
  const spokesH = new Graphics().rect(radius * 0.15, radius - 0.5, radius * 1.7, 1).fill(0x4d5560)
  const spokesV = new Graphics().rect(radius - 0.5, radius * 0.15, 1, radius * 1.7).fill(0x4d5560)
  const hub = new Graphics().rect(radius - 0.5, radius - 0.5, 1, 1).fill(0x74818f)
  container.addChild(rim, spokesH, spokesV, hub)

  let phase = 0
  return {
    container,
    spin: (speed: number, dt: number) => {
      if (speed === 0) return
      phase = (phase + Math.abs(dt * speed) * 0.5) % 1
      const frame = phase < 0.5
      spokesH.visible = frame
      spokesV.visible = !frame
    },
  }
}

interface Particle {
  node: Container
  vx: number
  vy: number
  life: number
  maxLife: number
  gravity: number
}

export interface SpawnOptions {
  vx?: number
  vy?: number
  life?: number
  gravity?: number
}

/** Tiny transient nodes (dust, smoke, flying scrap). */
export class Particles {
  readonly container = new Container()
  private readonly items: Particle[] = []

  spawn(node: Container, x: number, y: number, options: SpawnOptions = {}): void {
    node.position.set(x, y)
    this.items.push({
      node,
      vx: options.vx ?? 0,
      vy: options.vy ?? 0,
      life: 0,
      maxLife: options.life ?? 0.5,
      gravity: options.gravity ?? 0,
    })
    this.container.addChild(node)
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]
      if (!item) continue
      item.life += dt
      item.vy += item.gravity * dt
      item.node.x += item.vx * dt
      item.node.y += item.vy * dt
      const progress = item.life / item.maxLife
      if (progress >= 1) {
        this.container.removeChild(item.node)
        item.node.destroy()
        this.items.splice(i, 1)
      } else {
        item.node.alpha = 1 - progress
      }
    }
  }
}

/**
 * Vẽ theo chiều sâu: vật ở y LỚN hơn (gần người xem hơn) vẽ sau. Gọi SAU khi đã
 * cập nhật vị trí actor trong frame — thứ tự layer tĩnh không che đúng khi hai
 * diễn viên chồng nhau (luật hình #4 trong AGENTS). Số actor mỗi khu nhỏ (≤ 10)
 * nên sort mỗi frame vô hại.
 */
export function sortByDepth(container: Container): void {
  const children = container.children
  if (children.length < 2) return
  const sorted = [...children].sort((a, b) => a.y - b.y)
  for (let i = 0; i < sorted.length; i++) {
    const child = sorted[i]
    if (child && children[i] !== child) container.setChildIndex(child, i)
  }
}

/**
 * Đưa prop TĨNH (chòi gác, lò rèn, chồng kho...) vào lớp depth — thường là container
 * actor — để nó che/được che theo y như mọi diễn viên. Art vẫn viết bằng **toạ độ
 * tuyệt đối của khu** (không phải sửa drawer): node bọc đặt ở ĐƯỜNG CHÂN prop, còn
 * Graphics trả về bị dịch ngược lại đúng chỗ cũ.
 */
export function depthArt(parent: Container, groundY: number): Graphics {
  const art = new Graphics()
  art.position.set(0, -groundY)
  const node = new Container()
  node.position.set(0, groundY)
  node.addChild(art)
  parent.addChild(node)
  return art
}

/** Như `depthArt` nhưng trả container cho thứ bị vẽ lại nhiều lần (chồng kho, chồng pallet). */
export function depthSlot(parent: Container, groundY: number): Container {
  const slot = new Container()
  slot.position.set(0, -groundY)
  const node = new Container()
  node.position.set(0, groundY)
  node.addChild(slot)
  parent.addChild(node)
  return slot
}

export function dustPuff(): Graphics {
  return new Graphics().rect(0, 0, 2, 2).fill({ color: 0xd8d2c2, alpha: 0.7 })
}

/** Driver at the wheel, seen through a cab's side glass — cap + head; shoulders hide behind the door line. */
export function drawCabDriver(x: number, y: number, capColor: number): Graphics {
  const g = new Graphics()
  g.rect(x + 0.4, y, 4.6, 2.2).fill(capColor)
  g.rect(x + 0.8, y + 2, 3.8, 2.6).fill(0xe8c099)
  return g
}

export function smokePuff(): Graphics {
  return new Graphics().rect(0, 0, 3, 3).fill({ color: 0xa0a6b2, alpha: 0.6 })
}

export interface PersonSprite {
  container: Container
  body: Container
  face: Graphics
  legsL: Graphics
  legsR: Graphics
  armsL: Container
  armsR: Container
}

export type HatKind = 'straw' | 'cap' | 'none' | 'hard'

/**
 * Look overrides a body can be given on top of its variant palette — this is how
 * gear shows up on the character. Everything is applied at BUILD time (the player
 * layer rebuilds its sprite when gear changes), so no layer has to be
 * runtime-swappable. Keys come from content (`GearDef.style`).
 */
export interface BodyStyle {
  readonly hat?: HatKind
  readonly shirt?: string
  readonly pants?: string
  readonly shoes?: string
}

/** Gear palette: hi-vis vest, overalls denim, boots, hard hat. */
const VEST = 0xe8a13c
const VEST_STRIPE = 0xd9dfe6
const UNDERSHIRT = 0x4a5568
const OVERALLS = 0x35507a
const BOOT = 0x2f2a26
const HARD_HAT = 0xf2c14a

/**
 * Tilted ¾-view person at double density, built from squared slabs only
 * (Minecraft-style): box head under a stepped straw hat, a box cap, or nothing
 * ('none' — the blank mannequin used to review poses), rect
 * limbs, blocky two-step ground shadow — no rounded shapes anywhere. Limb
 * nodes are drawn at the origin and positioned via their `x` — the convention
 * the actors and the studio both move them by — so the rest pose sits inside
 * the torso silhouette instead of doubling the offset. Shading reuses the
 * decor block recipe under the game's top-left sun: contact shadow → dark
 * shoe rim at the ground → lit shoulders and shaded hips → lit crown of the
 * hat. Origin = feet; "forward" is local +x, so the actor flips
 * `container.scale.x`; walking north hides the face (back view).
 *
 * `style` dresses the body with gear (one override per slot); the default look
 * is exactly what the game shipped before gear existed.
 */
export function createPersonSprite(variant: number, hat: HatKind, style: BodyStyle = {}): PersonSprite {
  const SHIRTS = [0x5a82c2, 0x9a6bbf, 0x4fa06a]
  const PANTS = [0x3a4256, 0x443f52]
  const HAIRS = [0x4a3b2c, 0x2f2a26, 0x6b5a45]
  const SKIN = 0xe8c099
  const hatKind = style.hat ?? hat
  const vest = style.shirt === 'vest'
  const overalls = style.pants === 'overalls'
  const booted = style.shoes === 'boot'
  const shirt = vest ? VEST : (SHIRTS[variant % SHIRTS.length] ?? 0x5a82c2)
  const pants = overalls ? OVERALLS : (PANTS[variant % PANTS.length] ?? 0x3a4256)
  const hair = HAIRS[variant % HAIRS.length] ?? 0x4a3b2c

  const container = new Container()
  const shadow = new Graphics().rect(-6.4, -3, 15.8, 6).fill(SHADOW)
  shadow.rect(-4.6, -1.9, 12, 3.8).fill({ color: 0x000000, alpha: 0.08 })

  const drawLeg = (): Graphics => {
    const leg = new Graphics()
    leg.rect(0, -6, 3.5, 6).fill(pants)
    leg.rect(2.5, -6, 1, 6).fill({ color: 0x000000, alpha: 0.14 })
    leg.rect(0, -2.7, 3.5, 0.8).fill({ color: 0x000000, alpha: 0.16 })
    if (booted) {
      // Ủng cao cổ: cổ ủng cao hơn giày, có gấu lật lên và đế dày.
      leg.rect(-0.3, -3.6, 4.1, 3.6).fill(BOOT)
      leg.rect(-0.3, -3.6, 4.1, 0.7).fill({ color: 0xffffff, alpha: 0.12 })
      leg.rect(-0.3, -2.9, 4.1, 0.5).fill({ color: 0x000000, alpha: 0.18 })
      leg.rect(-0.3, -0.5, 4.1, 0.5).fill(0x1f1c19)
      return leg
    }
    leg.rect(-0.2, -1.9, 3.9, 1.9).fill(0x36322c)
    leg.rect(-0.2, -1.9, 3.9, 0.6).fill({ color: 0xffffff, alpha: 0.12 })
    leg.rect(-0.2, -0.5, 3.9, 0.5).fill(0x1f1c19)
    return leg
  }

  const legsL = drawLeg()
  legsL.position.set(-3.8, 0)
  const legsR = drawLeg()
  legsR.position.set(0.3, 0)

  const body = new Container()
  const drawArm = (outerLit: boolean): Container => {
    const arm = new Container()
    // Áo phản quang là áo khoác ngoài: tay áo vẫn là áo lót, chỉ thân là màu phản quang.
    const sleeve = new Graphics().rect(0, -15, 3, 8).fill(vest ? UNDERSHIRT : shirt)
    sleeve.rect(0, -15, 3, 0.8).fill({ color: 0xffffff, alpha: 0.08 })
    sleeve
      .rect(outerLit ? 0 : 2.1, -14.2, 0.9, 7.2)
      .fill(outerLit ? { color: 0xffffff, alpha: 0.12 } : { color: 0x000000, alpha: 0.14 })
    const hand = new Graphics().rect(0, -8.4, 3, 2.4).fill(SKIN)
    hand.rect(0, -6.6, 3, 0.6).fill({ color: 0x000000, alpha: 0.1 })
    const cuff = new Graphics().rect(0, -8.2, 3, 0.9).fill({ color: 0x000000, alpha: 0.18 })
    arm.addChild(sleeve, hand, cuff)
    return arm
  }

  const armsL = drawArm(true)
  armsL.position.set(-7.5, 0)
  const armsR = drawArm(false)
  armsR.position.set(4.5, 0)

  const torso = new Graphics().rect(-5.5, -16.5, 11, 11).fill(shirt)
  torso.rect(-5.5, -16.5, 11, 1.5).fill({ color: 0xffffff, alpha: 0.14 })
  torso.rect(-5.5, -15, 0.9, 9.5).fill({ color: 0xffffff, alpha: 0.07 })
  torso.rect(4.6, -15, 0.9, 9.5).fill({ color: 0x000000, alpha: 0.08 })
  torso.rect(-5.5, -6.4, 11, 0.9).fill({ color: 0x000000, alpha: 0.12 })
  torso.rect(-3, -16.5, 6, 2).fill({ color: 0xffffff, alpha: 0.16 })
  torso.rect(-3, -13, 6, 2.5).fill({ color: 0x000000, alpha: 0.12 })
  torso.rect(-5.5, -7, 11, 1.5).fill({ color: 0x000000, alpha: 0.22 })
  torso.rect(-0.9, -7.1, 1.8, 1.7).fill({ color: 0x8a97a6, alpha: 0.9 })
  if (vest) {
    // Áo phản quang: hai sọc bạc ngang lưng, sọc dưới tối để vẫn đọc ra khối.
    torso.rect(-5.5, -13.4, 11, 1.2).fill(VEST_STRIPE)
    torso.rect(-5.5, -10.6, 11, 1.2).fill(VEST_STRIPE)
    torso.rect(3.6, -13.4, 1.9, 4).fill({ color: 0x000000, alpha: 0.12 })
  }
  if (overalls) {
    // Yếm quần: tấm yếm trước ngực + hai quai vắt qua vai, khoá đồng nhỏ.
    torso.rect(-3.4, -16.5, 6.8, 5.4).fill(OVERALLS)
    torso.rect(-3.4, -16.5, 6.8, 0.9).fill({ color: 0xffffff, alpha: 0.12 })
    torso.rect(2.2, -16.5, 1.2, 5.4).fill({ color: 0x000000, alpha: 0.12 })
    torso.rect(-3.4, -16.5, 1.2, 2.6).fill({ color: 0xffffff, alpha: 0.08 })
    torso.rect(-2.6, -16.4, 1.1, 1.1).fill({ color: 0xd8c07a, alpha: 0.95 })
    torso.rect(1.5, -16.4, 1.1, 1.1).fill({ color: 0xd8c07a, alpha: 0.95 })
  }

  const head = new Graphics().rect(-5, -26, 10, 10).fill(SKIN)
  head.rect(-5, -25, 1.2, 9).fill({ color: 0xffffff, alpha: 0.1 })
  head.rect(3.6, -25, 1.4, 9).fill({ color: 0x000000, alpha: 0.07 })
  head.rect(-5, -17.3, 10, 1.3).fill({ color: 0x000000, alpha: 0.07 })

  const hairBack = new Graphics().rect(-5, -23.2, 1.8, 4).fill(hair)

  const face = new Graphics()
  face.rect(-2.85, -21.3, 1.7, 1.7).fill(0x2b2320)
  face.rect(1.15, -21.3, 1.7, 1.7).fill(0x2b2320)
  face.rect(-2.55, -21.1, 0.55, 0.55).fill({ color: 0xffffff, alpha: 0.8 })
  face.rect(1.45, -21.1, 0.55, 0.55).fill({ color: 0xffffff, alpha: 0.8 })
  face.rect(-3.8, -19.4, 1.4, 1).fill({ color: 0xd88a6a, alpha: 0.5 })
  face.rect(2.4, -19.4, 1.4, 1).fill({ color: 0xd88a6a, alpha: 0.5 })
  face.rect(-0.8, -18.7, 1.6, 0.9).fill({ color: 0xc08a66, alpha: 0.8 })

  const hatContainer = new Container()
  if (hatKind === 'straw') {
    const HATS = [0xecc779, 0xd9b268, 0xf2d68f]
    const straw = HATS[variant % HATS.length] ?? 0xecc779
    const brim = new Graphics().rect(-8, -25.6, 16, 2.4).fill(straw)
    brim.rect(-8, -25.6, 16, 0.7).fill({ color: 0xffffff, alpha: 0.1 })
    brim.rect(-8, -23.9, 16, 0.7).fill({ color: 0x000000, alpha: 0.1 })
    const crown = new Graphics().rect(-4, -30, 8, 4.9).fill({ color: straw, alpha: 0.94 })
    crown.rect(-4, -30, 8, 1.1).fill({ color: 0xffffff, alpha: 0.15 })
    crown.rect(2.2, -29.2, 1.8, 4.1).fill({ color: 0x000000, alpha: 0.1 })
    const band = new Graphics().rect(-4.2, -26.4, 8.4, 1.3).fill({ color: 0xc8a25c, alpha: 0.9 })
    hatContainer.addChild(brim, crown, band)
  } else if (hatKind === 'cap') {
    const CAPS = [0x6fa0e0, 0x9ad46f, 0xf08a6a]
    const cap = CAPS[variant % CAPS.length] ?? 0x6fa0e0
    const brim = new Graphics().rect(-4.4, -23.4, 8.8, 2.2).fill({ color: cap, alpha: 0.88 })
    brim.rect(-4.4, -23.4, 8.8, 0.6).fill({ color: 0xffffff, alpha: 0.1 })
    brim.rect(-4.4, -21.8, 8.8, 0.6).fill({ color: 0x000000, alpha: 0.1 })
    const crown = new Graphics().rect(-4.6, -28.8, 9.2, 5.4).fill(cap)
    crown.rect(-4.6, -28.8, 9.2, 1.1).fill({ color: 0xffffff, alpha: 0.13 })
    crown.rect(2.4, -28, 2.2, 4.4).fill({ color: 0x000000, alpha: 0.12 })
    hatContainer.addChild(brim, crown)
  } else if (hatKind === 'hard') {
    // Nón bảo hộ: vành hẹp hơn nón rơm (không được rộng hơn khung bao đang khoá),
    // mũ chum ba bậc + gờ sống giữa, gầm vành tối để đọc ra khối.
    const brim = new Graphics().rect(-5.4, -25.8, 10.8, 1.6).fill(HARD_HAT)
    brim.rect(-5.4, -25.8, 10.8, 0.5).fill({ color: 0xffffff, alpha: 0.14 })
    brim.rect(-5.4, -24.6, 10.8, 0.4).fill({ color: 0x000000, alpha: 0.18 })
    const crown = new Graphics().rect(-4.4, -28.8, 8.8, 3.2).fill(HARD_HAT)
    crown.rect(-3.4, -29.6, 6.8, 0.9).fill(HARD_HAT)
    crown.rect(-3.4, -29.6, 6.8, 0.4).fill({ color: 0xffffff, alpha: 0.18 })
    crown.rect(-4.4, -28.8, 8.8, 0.7).fill({ color: 0xffffff, alpha: 0.12 })
    crown.rect(2.4, -28.4, 2, 2.8).fill({ color: 0x000000, alpha: 0.12 })
    const ridge = new Graphics().rect(-0.4, -29.8, 0.8, 1.4).fill({ color: 0xffffff, alpha: 0.16 })
    hatContainer.addChild(brim, crown, ridge)
  }

  body.addChild(armsL, armsR, torso, head, hairBack, face, hatContainer)
  container.addChild(shadow, legsL, legsR, body)
  return { container, body, face, legsL, legsR, armsL, armsR }
}
