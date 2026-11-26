/**
 * Linear undo/redo over immutable snapshots. Pushing a snapshot equal to the
 * current one is ignored, so callers can push after every change without
 * creating empty steps.
 */
export class History<T> {
  private past: T[] = []
  private future: T[] = []
  private current: T
  private limit: number
  private equal: (a: T, b: T) => boolean

  constructor(initial: T, limit = 100, equal: (a: T, b: T) => boolean = (a, b) => a === b) {
    this.current = initial
    this.limit = limit
    this.equal = equal
  }

  get present(): T {
    return this.current
  }

  get canUndo() {
    return this.past.length > 0
  }

  get canRedo() {
    return this.future.length > 0
  }

  /** Record a new state. Returns false when it equals the current one. */
  push(next: T): boolean {
    if (this.equal(next, this.current)) return false
    this.past.push(this.current)
    if (this.past.length > this.limit) this.past.shift()
    this.current = next
    this.future = []
    return true
  }

  undo(): T | undefined {
    const prev = this.past.pop()
    if (prev === undefined) return undefined
    this.future.push(this.current)
    this.current = prev
    return prev
  }

  redo(): T | undefined {
    const next = this.future.pop()
    if (next === undefined) return undefined
    this.past.push(this.current)
    this.current = next
    return next
  }

  /** Forget all steps and start again from `state`. */
  reset(state: T) {
    this.past = []
    this.future = []
    this.current = state
  }
}
