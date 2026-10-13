export type Unsubscribe = () => void

/**
 * Minimal observable store around a mutable state tree.
 *
 * - `update` runs the mutator against the live tree, then swaps the root
 *   reference so `useSyncExternalStore` subscribers re-render.
 * - Nested objects are shared between snapshots: treat the tree as a mutable
 *   model plus a version token, not as immutable data.
 */
export class ObservableStore<T extends object> {
  private state: T
  private readonly listeners = new Set<() => void>()

  constructor(initial: T) {
    this.state = initial
  }

  getSnapshot = (): T => this.state

  subscribe = (listener: () => void): Unsubscribe => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  update(mutator: (draft: T) => void): void {
    mutator(this.state)
    this.bump()
  }

  setState(next: T): void {
    this.state = next
    this.bump()
  }

  private bump(): void {
    this.state = { ...this.state }
    for (const listener of this.listeners) listener()
  }
}
