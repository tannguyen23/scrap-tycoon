import { makeRandom } from './random'

/**
 * Ports a game hands the scene kit. A pack must never import the game's own
 * player/singletons — that is the edge that would weld the kit to one project.
 * Sound ids are plain strings: the library itself is project content.
 */
export interface SceneAudio {
  /** One-shot at an edge-detected moment (never in a per-frame loop). */
  play(id: string): void
  /** Continuous bed level, 0..1. */
  setLoop(id: string, level: number): void
}

export interface SceneServices {
  readonly audio: SceneAudio
  readonly random: (seed: number) => () => number
}

/** Silent default, so a scene can be mounted in a test or a preview with no audio. */
export const SILENT_AUDIO: SceneAudio = { play: () => {}, setLoop: () => {} }

export const DEFAULT_SERVICES: SceneServices = { audio: SILENT_AUDIO, random: makeRandom }
