import { Container, Text } from 'pixi.js'

/** Popup wording, resolved to the active locale before it reaches the scene. */
export interface PopupLabels {
  produced: string
  money: string
}

/**
 * Label drawer seam: the real one rasterises a Pixi `Text` (needs a DOM canvas),
 * tests inject a stub so the manager can run in the node environment.
 */
export type LabelFactory = (text: string, color: number) => Container

export interface Popups {
  readonly container: Container
  setLabels(labels: PopupLabels): void
  /** "+1 <sắt vụn>" trên đầu thợ nhặt khi chọt trúng lon. */
  scrap(x: number, y: number): void
  /** "+ <tiền>" trên đầu xe khi hàng xuất qua trạm. */
  money(x: number, y: number): void
  /** Nhãn chung cho sự kiện khác sau này. */
  spawn(text: string, x: number, y: number, color: number): void
  update(dt: number): void
}

const SCRAP_COLOR = 0x9ad46f
const MONEY_COLOR = 0xffb454
const LIFE = 0.9
const RISE = 16

/**
 * Outlined label readable on any ground. Mono, not the pixel face: Press Start
 * 2P ships no Vietnamese glyphs (latin + latin-ext subsets only), and popup
 * names come from content in the active locale.
 */
function createOutlinedLabel(text: string, color: number): Container {
  const label = new Text({
    text,
    style: {
      fontFamily: 'JetBrains Mono',
      fontSize: 8,
      fontWeight: '700',
      fill: color,
      stroke: { color: 0x201810, width: 3 },
    },
  })
  label.anchor.set(0.5)
  return label
}

interface Popup {
  node: Container
  y: number
  life: number
}

/**
 * Floating "+resource" text above actors (the `Particles` pattern, one manager
 * per zone): each popup drifts up on an ease-out curve and fades in the last
 * stretch of its short life.
 */
export function createPopups(createLabel: LabelFactory = createOutlinedLabel): Popups {
  const container = new Container()
  const items: Popup[] = []
  let labels: PopupLabels = { produced: '', money: '' }
  let seed = 0x2545f491

  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const spawn = (text: string, x: number, y: number, color: number): void => {
    const node = createLabel(text, color)
    node.position.set(Math.round(x + (rnd() - 0.5) * 6), Math.round(y))
    container.addChild(node)
    items.push({ node, y, life: 0 })
  }

  return {
    container,
    setLabels: (next) => {
      labels = next
    },
    scrap: (x, y) => spawn(`+1 ${labels.produced}`, x, y, SCRAP_COLOR),
    money: (x, y) => spawn(`+ ${labels.money}`, x, y, MONEY_COLOR),
    spawn,
    update: (dt) => {
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i]
        if (!item) continue
        item.life += dt
        const q = item.life / LIFE
        if (q >= 1) {
          container.removeChild(item.node)
          item.node.destroy()
          items.splice(i, 1)
          continue
        }
        const eased = 1 - (1 - q) * (1 - q)
        item.node.y = item.y - RISE * eased
        item.node.alpha = q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45
      }
    },
  }
}
