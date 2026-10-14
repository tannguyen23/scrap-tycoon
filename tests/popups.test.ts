import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { createPopups } from '@ui/scene/focus/popups'

/** Popup labels draw through a stub in node — the real one needs a DOM canvas. */
function stubLabel(text: string): Container {
  const node = new Container()
  node.label = text
  return node
}

describe('popups manager', () => {
  it('spawns a localized label that drifts up, fades and cleans itself up', () => {
    const popups = createPopups(stubLabel)
    popups.setLabels({ produced: 'Sắt vụn', money: 'Tiền' })
    popups.scrap(100, 80)

    const node = popups.container.children[0]
    expect(node?.label).toBe('+1 Sắt vụn')

    const startY = node?.y ?? 0
    popups.update(0.3)
    expect(node?.y).toBeLessThan(startY)
    expect(node?.alpha).toBe(1)

    popups.update(0.5)
    expect(node?.alpha).toBeLessThan(1)

    popups.update(0.2)
    expect(popups.container.children.length).toBe(0)
  })

  it('spawns the money label for the export crossing', () => {
    const popups = createPopups(stubLabel)
    popups.setLabels({ produced: 'Scrap Metal', money: 'Coins' })
    popups.money(200, 40)
    expect(popups.container.children[0]?.label).toBe('+ Coins')
  })
})
