import type { Application, Container } from 'pixi.js'
import type { ReactNode } from 'react'

/** A label box drawn over the stage, in canvas pixels. */
export interface StageCell {
  label: string
  x: number
  y: number
  width: number
  height: number
  /** How the label is styled: section heading, plain label or an on-tile chip. */
  kind?: 'caption' | 'label' | 'tile'
  /** 4-corner bitmask (1 TL, 2 TR, 4 BR, 8 BL) shown as a mini diagram. */
  mask?: number
}

export interface StageApi {
  setTime?(time: number): void
  /** Characters sheet: mirror every figure. */
  setFacing?(facing: 1 | -1): void
  /** Characters sheet: freeze the clocks to inspect a pose. */
  setPaused?(paused: boolean): void
  /** Weather preview: pin one kind by id, or null to follow the schedule. */
  setWeather?(kindId: string | null): void
  /** Weather preview: flash one lightning strike right now. */
  strike?(): void
}

export interface StageScene {
  root: Container
  width: number
  height: number
  update?(dt: number, elapsed: number): void
  cells?: readonly StageCell[]
  api?: StageApi
}

export type StageBuilder = (app: Application) => StageScene

/** One tab of the studio: the kit's own tabs plus one set per project. */
export interface StudioTab {
  readonly id: string
  readonly label: string
  render(): ReactNode
}

/**
 * A project plugged into the hub. The studio renders its tabs and boots its chrome
 * without importing its modules (dependency rule), so a new project is one adapter
 * module plus one line in `projects.ts`.
 */
export interface StudioProject {
  readonly id: string
  readonly label: string
  /** Theme, cursor art and audio unlock, supplied by the project the studio boots in. */
  installChrome?(): void
  readonly tabs: readonly StudioTab[]
}