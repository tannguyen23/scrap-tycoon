/**
 * Converts real elapsed time into a whole number of fixed simulation steps,
 * carrying the remainder over so no time is lost between frames.
 */
export class FixedStepClock {
  private accumulator = 0
  private readonly stepSeconds: number

  constructor(stepSeconds: number) {
    this.stepSeconds = stepSeconds
  }

  advance(elapsedSeconds: number): number {
    this.accumulator += Math.max(0, elapsedSeconds)
    const steps = Math.floor(this.accumulator / this.stepSeconds)
    this.accumulator -= steps * this.stepSeconds
    return steps
  }

  reset(): void {
    this.accumulator = 0
  }
}
