import type { ObservableStore } from '@core/store'
import type { GameContent, GameState } from '@domain/types'
import type { LocaleStore } from '@i18n/locale'
import type { Locale } from '@i18n/types'
import { mountScene, type SceneHandle } from '@scene/core/scene'
import { DEFAULT_SERVICES, type SceneServices } from '@scene/core/services'
import { buildSceneFeed } from './feed'
import { createScrapScenePack } from './scrapPack'

export type { SceneHandle }

export interface SceneOptions {
  /** Fired when a user gesture (wheel) changes the zoom level. */
  onZoomLevelChange?: (level: number) => void
  /** Live locale for scene text (popups). Missing in dev tools — defaults to Vietnamese. */
  localeStore?: LocaleStore
  /** Sound + randomness ports. Defaults to silence and the kit's own PRNG. */
  services?: SceneServices
}

/**
 * The project's half of the scene seam: it subscribes to the store, turns the
 * state into a `SceneFeed`, and hands that to the kit's `mountScene` along with
 * the scrap-yard scene pack. Everything the camera, LOD ladder, culling and
 * input need lives in `scene/core`; nothing here knows about PixiJS.
 */
export async function mountGameScene(
  host: HTMLElement,
  store: ObservableStore<GameState>,
  content: GameContent,
  options: SceneOptions = {},
): Promise<SceneHandle> {
  const localeStore = options.localeStore
  let locale: Locale = localeStore?.get() ?? 'vi'

  const handle = await mountScene(host, createScrapScenePack(content), options.services ?? DEFAULT_SERVICES, {
    onZoomLevelChange: options.onZoomLevelChange,
  })

  const push = (): void => {
    handle.setFeed(buildSceneFeed(content, store.getSnapshot(), locale))
  }

  const unsubscribe = store.subscribe(push)
  // New popups follow the language switch; ones already flying keep their text.
  const unsubscribeLocale = localeStore?.subscribe(() => {
    locale = localeStore.get()
    push()
  })
  push()

  return {
    destroy: () => {
      unsubscribe()
      unsubscribeLocale?.()
      handle.destroy()
    },
    setZoomLevel: handle.setZoomLevel,
    panTo: handle.panTo,
    setHighlight: handle.setHighlight,
    setFeed: handle.setFeed,
  }
}
