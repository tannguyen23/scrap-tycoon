import type { ObservableStore } from '@core/store'
import type { Rect } from '@ground/core/metrics'
import { playerWalkSpeed } from '@domain/selectors'
import type { GameContent, GameState, WorkPose } from '@domain/types'
import type { LocaleStore } from '@i18n/locale'
import type { Locale } from '@i18n/types'
import { mountScene, type SceneHandle } from '@scene/core/scene'
import { DEFAULT_SERVICES, type SceneServices } from '@scene/core/services'
import { buildSceneFeed } from './feed'
import { gearLook } from './gearLook'
import { LOOSE_REACH, looseWorldPoint } from './loose'
import type { PickableLoose, PlayerReadout } from './player'
import { createScrapScene } from './scrapPack'

export type { SceneHandle }

/**
 * The scene the game actually talks to: the kit's handle plus the two things only
 * the project knows — where the player is (the HUD's work bar polls it) and how to
 * bring the camera back to them after a look-around.
 */
export interface GameScene extends SceneHandle {
  player(): PlayerReadout | null
  /** The piece of debris the player is standing next to, or null. */
  pickable(): PickableLoose | null
  focusPlayer(): void
  setWorking(pose: WorkPose | null): void
  /** Freeze the walker while a full-screen HUD panel is up (the inventory). */
  freezeWalk(frozen: boolean): void
}

export interface SceneOptions {
  /** Fired when a user gesture (wheel) changes the zoom level. */
  onZoomLevelChange?: (level: number) => void
  /** Fired when the visible world rect changes (the minimap reads it). */
  onViewChange?: (view: Rect) => void
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
): Promise<GameScene> {
  const localeStore = options.localeStore
  let locale: Locale = localeStore?.get() ?? 'vi'

  const scene = createScrapScene(content)
  const handle = await mountScene(host, scene.pack, options.services ?? DEFAULT_SERVICES, {
    onZoomLevelChange: options.onZoomLevelChange,
    onViewChange: options.onViewChange,
  })

  // The camera rides the player by default; a manual drag pauses it and
  // `focusPlayer` (the HUD's "back to the player" chip) resumes it.
  const player = scene.player()
  if (player) handle.setFollow(player.position)

  // The body is dressed from gear and the walk speed comes out of the modifier
  // pipeline — both read straight from state, and only rebuilt when the look
  // actually changes (a rebuild re-creates the sprite).
  let lookKey = JSON.stringify(gearLook(store.getSnapshot(), content))

  /** The piece of debris nearest the player that is within reach, or null. */
  const nearestPick = (): { id: number; item: string } | null => {
    const spot = player?.position
    if (!spot) return null
    let best: { id: number; item: string; distance: number } | null = null
    for (const piece of store.getSnapshot().loose.items) {
      const world = looseWorldPoint(piece.zone, piece.id)
      const distance = Math.hypot(world.x - spot.x, world.y - spot.y)
      if (distance > LOOSE_REACH) continue
      if (!best || distance < best.distance) best = { id: piece.id, item: piece.item, distance }
    }
    return best ? { id: best.id, item: best.item } : null
  }

  const push = (): void => {
    const state = store.getSnapshot()
    // The zone feed carries the prompt for the piece in reach, so its detail scene
    // can hang the "pick up" sign right at that piece.
    handle.setFeed(buildSceneFeed(content, state, locale, nearestPick()?.id ?? null))
    if (player) {
      const look = gearLook(state, content)
      const key = JSON.stringify(look)
      if (key !== lookKey) {
        lookKey = key
        player.setLook(look)
      }
      player.setWalkMultiplier(playerWalkSpeed(state, content).toNumber())
    }
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
    focusOn: handle.focusOn,
    setFollow: handle.setFollow,
    player: () => player?.readout() ?? null,
    pickable: nearestPick,
    focusPlayer: () => {
      if (player) handle.focusOn(player.position.x, player.position.y)
    },
    setWorking: (pose) => player?.setWorking(pose),
    freezeWalk: (frozen) => player?.setFrozen(frozen),
  }
}
