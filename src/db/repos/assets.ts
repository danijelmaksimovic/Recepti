import type { Asset, AssetKind, Id } from '@/domain/types'
import { db } from '../schema'
import { AssetInUseError, RecordNotFoundError, guardWrite } from '../errors'
import { cleanList, newId, now, sha256 } from '../util'

export interface NewAsset {
  kind: AssetKind
  blob: Blob
  thumb?: Blob
  width: number
  height: number
  name?: string
  tags?: string[]
  sketchData?: unknown
  /** Defaults to `blob.type`. */
  mime?: string
}

export interface AddAssetResult {
  asset: Asset
  /** True when identical bytes were already stored and the existing asset was reused. */
  deduplicated: boolean
}

/**
 * Store an asset once. If the same bytes are already stored (SHA-256 match),
 * the existing asset is returned instead of a copy (BLUEPRINT §3).
 */
export async function addAsset(input: NewAsset): Promise<AddAssetResult> {
  const hash = await sha256(input.blob)
  return guardWrite(() =>
    db.transaction('rw', db.assets, async () => {
      const existing = await db.assets.where('hash').equals(hash).first()
      if (existing) return { asset: existing, deduplicated: true }
      const t = now()
      const asset: Asset = {
        id: newId(),
        kind: input.kind,
        blob: input.blob,
        thumb: input.thumb,
        mime: input.mime ?? (input.blob.type || 'application/octet-stream'),
        width: input.width,
        height: input.height,
        bytes: input.blob.size,
        hash,
        name: input.name?.trim() ?? '',
        tags: cleanList(input.tags),
        sketchData: input.sketchData,
        createdAt: t,
        updatedAt: t,
      }
      await db.assets.add(asset)
      return { asset, deduplicated: false }
    }),
  )
}

export function getAsset(id: Id): Promise<Asset | undefined> {
  return db.assets.get(id)
}

export function listAssets(kind?: AssetKind): Promise<Asset[]> {
  const q = kind ? db.assets.where('kind').equals(kind) : db.assets.toCollection()
  return q.reverse().sortBy('createdAt')
}

export type AssetPatch = Partial<Pick<Asset, 'name' | 'tags' | 'kind' | 'thumb' | 'sketchData'>>

export async function updateAsset(id: Id, patch: AssetPatch): Promise<Asset> {
  return guardWrite(() =>
    db.transaction('rw', db.assets, async () => {
      const current = await db.assets.get(id)
      if (!current) throw new RecordNotFoundError('Asset', id)
      const next: Asset = {
        ...current,
        ...patch,
        name: patch.name !== undefined ? patch.name.trim() : current.name,
        tags: patch.tags !== undefined ? cleanList(patch.tags) : current.tags,
        updatedAt: now(),
      }
      await db.assets.put(next)
      return next
    }),
  )
}

/**
 * How many records reference the asset: recipe photos, design and template
 * canvases, and collection covers. Call inside a transaction that includes
 * those tables when the answer must stay true for a following write.
 */
export async function countAssetUsage(id: Id): Promise<number> {
  const [recipes, designs, templates, collections] = await Promise.all([
    db.recipes.where('photoAssetIds').equals(id).count(),
    db.designs.where('assetIds').equals(id).count(),
    db.templates.where('assetIds').equals(id).count(),
    db.collections.filter((c) => c.coverAssetId === id).count(),
  ])
  return recipes + designs + templates + collections
}

const usageTables = () => [db.assets, db.recipes, db.designs, db.templates, db.collections]

/** Delete an asset. Throws `AssetInUseError` if anything still references it. */
export async function deleteAsset(id: Id): Promise<void> {
  return guardWrite(() =>
    db.transaction('rw', usageTables(), async () => {
      const usage = await countAssetUsage(id)
      if (usage > 0) throw new AssetInUseError(id, usage)
      await db.assets.delete(id)
    }),
  )
}

/** Delete each asset that nothing references. Returns the ids actually deleted. */
export async function deleteAssetsIfUnused(ids: Iterable<Id>): Promise<Id[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  return guardWrite(() => db.transaction('rw', usageTables(), () => deleteUnusedInTx(unique)))
}

/** Must run inside a rw transaction over `usageTables()`. */
export async function deleteUnusedInTx(ids: Id[]): Promise<Id[]> {
  const deleted: Id[] = []
  for (const id of ids) {
    if ((await countAssetUsage(id)) === 0 && (await db.assets.get(id))) {
      await db.assets.delete(id)
      deleted.push(id)
    }
  }
  return deleted
}

/** Assets nothing references, for the "Clean unused assets" preview in Settings. */
export async function findUnusedAssets(): Promise<Asset[]> {
  return db.transaction('r', usageTables(), async () => {
    const used = new Set<Id>()
    await db.recipes.each((r) => r.photoAssetIds.forEach((a) => used.add(a)))
    await db.designs.each((d) => d.assetIds.forEach((a) => used.add(a)))
    await db.templates.each((t) => t.assetIds.forEach((a) => used.add(a)))
    await db.collections.each((c) => c.coverAssetId && used.add(c.coverAssetId))
    return db.assets.filter((a) => !used.has(a.id)).toArray()
  })
}
