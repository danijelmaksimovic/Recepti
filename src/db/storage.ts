export interface StorageInfo {
  /** Bytes used by this origin, if the browser reports it. */
  usage?: number
  /** Bytes this origin may use, if the browser reports it. */
  quota?: number
  /** True when the browser promised not to evict our data. */
  persisted?: boolean
}

/** What Settings shows about local storage (BLUEPRINT §3). Never throws. */
export async function getStorageInfo(): Promise<StorageInfo> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined
  const [estimate, persisted] = await Promise.all([
    s?.estimate?.().catch(() => undefined),
    s?.persisted?.().catch(() => undefined),
  ])
  return { usage: estimate?.usage, quota: estimate?.quota, persisted }
}
