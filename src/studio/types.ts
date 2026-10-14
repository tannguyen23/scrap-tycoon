import type { Application, Container } from 'pixi.js'

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