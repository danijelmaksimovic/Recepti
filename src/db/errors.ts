/** Base class for every error the storage layer throws on purpose. */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StorageError'
  }
}

/** The browser refused a write because the origin's storage quota is used up. */
export class StorageFullError extends StorageError {
  constructor(cause?: unknown) {
    super('Storage is full. Make a backup and remove unused assets to free up space.', { cause })
    this.name = 'StorageFullError'
  }
}

// Not called "NotFoundError": Dexie maps errors with DOMException names to its own classes.
export class RecordNotFoundError extends StorageError {
  constructor(table: string, id: string) {
    super(`${table} ${id} not found`)
    this.name = 'RecordNotFoundError'
  }
}

export class ValidationError extends StorageError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** An asset cannot be deleted because a recipe, design, template or collection still uses it. */
export class AssetInUseError extends StorageError {
  constructor(
    public readonly assetId: string,
    public readonly usage: number,
  ) {
    super(`Asset is still used in ${usage} place${usage === 1 ? '' : 's'}`)
    this.name = 'AssetInUseError'
  }
}

function isQuotaError(err: unknown): boolean {
  for (let e = err as { name?: string; inner?: unknown; cause?: unknown } | undefined, i = 0; e && i < 5; i++) {
    if (e.name === 'QuotaExceededError') return true
    // Dexie wraps native errors in `inner`; some engines report the old code name.
    if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true
    e = (e.inner ?? e.cause) as typeof e
  }
  return false
}

type Listener = (err: StorageError) => void
const listeners = new Set<Listener>()

/** Subscribe to failed writes (e.g. to show a toast). Returns an unsubscribe function. */
export function onStorageError(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Run a write. Quota failures become `StorageFullError`, unknown failures
 * become `StorageError`; both are reported to `onStorageError` listeners and rethrown.
 */
export async function guardWrite<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    // Deliberate errors (bad input, missing record, asset in use) and errors an
    // inner guardWrite already reported are passed through untouched.
    if (err instanceof StorageError) throw err
    const wrapped = isQuotaError(err) ? new StorageFullError(err) : new StorageError('Could not save your changes.', { cause: err })
    for (const l of listeners) {
      try {
        l(wrapped)
      } catch {
        /* a broken listener must not hide the real error */
      }
    }
    throw wrapped
  }
}
