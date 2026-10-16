import { Engine } from '@app/engine'
import { BALANCE } from '@content/balance'
import { GAME_CONTENT } from '@content/index'
import { Decimal } from '@core/num'
import { SaveManager } from '@core/save/saveManager'
import { ObservableStore } from '@core/store'
import { workerCount } from '@domain/selectors'
import { createFreshState, stateFromSerialized } from '@domain/state'
import type { GameState } from '@domain/types'
import { MemoryStorageAdapter } from '@platform/storage'
import { describe, expect, it } from 'vitest'
import { emptyBagSlots, seedBag } from './fixtures'

interface Rig {
  engine: Engine
  store: ObservableStore<GameState>
  saveManager: SaveManager
}

function makeRig(): Rig {
  const storage = new MemoryStorageAdapter()
  const saveManager = new SaveManager(storage, 'save')
  const store = new ObservableStore(createFreshState(GAME_CONTENT, BALANCE.startMoney))
  const engine = new Engine({
    content: GAME_CONTENT,
    store,
    saveManager,
    startMoney: BALANCE.startMoney,
    offlineCapSeconds: BALANCE.offlineCapHours * 3600,
    offlineModalThresholdSeconds: BALANCE.offlineModalThresholdSeconds,
  })
  return { engine, store, saveManager }
}

describe('engine save reset', () => {
  it('survives the unload autosave that follows the reset reload', () => {
    const { engine, store, saveManager } = makeRig()
    store.update((draft) => {
      draft.resources['money'] = new Decimal(5000)
      seedBag(draft, GAME_CONTENT, 'sack', new Decimal(3))
      draft.gear['vest'] = true
    })
    expect(engine.buyWorker('scrap', 'scavenger', 2).ok).toBe(true)
    engine.saveNow()
    expect(saveManager.read()).not.toBeNull()

    engine.resetSave()
    // The storage slot is gone right after the reset…
    expect(saveManager.read()).toBeNull()

    // …and the loop's beforeunload autosave (fired by the reload) writes the
    // fresh run instead of resurrecting the old one.
    engine.saveNow()
    const file = saveManager.read()
    if (!file) throw new Error('the post-reset autosave did not write')
    const hydrated = stateFromSerialized(file.state, GAME_CONTENT, BALANCE.startMoney)
    expect(workerCount(hydrated.state, 'scrap', 'scavenger')).toBe(0)
    expect(hydrated.state.bag).toEqual(emptyBagSlots(GAME_CONTENT))
    expect(hydrated.state.gear).toEqual({})

    const live = store.getSnapshot()
    expect(workerCount(live, 'scrap', 'scavenger')).toBe(0)
    expect(live.resources['money']?.toString()).toBe(BALANCE.startMoney.toString())
    expect(live.bag).toEqual(emptyBagSlots(GAME_CONTENT))
    expect(live.gear).toEqual({})
  })

  it('re-arms milestone announcements for the new run', () => {
    const { engine, store } = makeRig()
    const announced: string[] = []
    engine.setMilestoneHandler((milestone) => announced.push(milestone.id))

    store.update((draft) => {
      draft.resources['money'] = new Decimal(1_000_000)
    })
    expect(engine.buyWorker('scrap', 'porter', 1).ok).toBe(true)
    expect(engine.buyWorker('scrap', 'smelter', 1).ok).toBe(true)
    expect(announced).toEqual(['forge-fired'])

    engine.resetSave()
    expect(announced).toEqual(['forge-fired'])

    store.update((draft) => {
      draft.resources['money'] = new Decimal(1_000_000)
    })
    expect(engine.buyWorker('scrap', 'porter', 1).ok).toBe(true)
    expect(engine.buyWorker('scrap', 'smelter', 1).ok).toBe(true)
    expect(announced).toEqual(['forge-fired', 'forge-fired'])
  })
})
