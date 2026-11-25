import type { Id, Timestamp } from '@/domain/types'

export function newId(): Id {
  return crypto.randomUUID()
}

export function now(): Timestamp {
  return Date.now()
}

/** Hex SHA-256 of a blob's bytes. */
export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Trimmed, de-duplicated, non-empty strings in their original order. */
export function cleanList(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>()
  for (const v of values ?? []) {
    const t = v.trim()
    if (t) seen.add(t)
  }
  return [...seen]
}

/**
 * Every `assetId` string anywhere inside a Fabric canvas JSON tree.
 * Used to recompute `assetIds` on each design/template save (BLUEPRINT §3).
 */
export function extractAssetIds(canvas: unknown): Id[] {
  const found = new Set<Id>()
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'assetId' && typeof v === 'string' && v) found.add(v)
        else walk(v)
      }
    }
  }
  walk(canvas)
  return [...found]
}
