import type { Collection, Id } from '@/domain/types'
import { db } from '../schema'
import { RecordNotFoundError, ValidationError, guardWrite } from '../errors'
import { newId, now } from '../util'

export function listCollections(): Promise<Collection[]> {
  return db.collections.orderBy('sortOrder').toArray()
}

export function getCollection(id: Id): Promise<Collection | undefined> {
  return db.collections.get(id)
}

function cleanName(name: string): string {
  const n = name.trim()
  if (!n) throw new ValidationError('Collection needs a name')
  return n
}

export async function createCollection(input: { name: string; coverAssetId?: Id }): Promise<Collection> {
  return guardWrite(() =>
    db.transaction('rw', db.collections, async () => {
      const last = await db.collections.orderBy('sortOrder').last()
      const t = now()
      const collection: Collection = {
        id: newId(),
        name: cleanName(input.name),
        coverAssetId: input.coverAssetId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdAt: t,
        updatedAt: t,
      }
      await db.collections.add(collection)
      return collection
    }),
  )
}

export async function updateCollection(id: Id, patch: { name?: string; coverAssetId?: Id | null }): Promise<Collection> {
  return guardWrite(() =>
    db.transaction('rw', db.collections, async () => {
      const current = await db.collections.get(id)
      if (!current) throw new RecordNotFoundError('Collection', id)
      const next: Collection = {
        ...current,
        name: patch.name !== undefined ? cleanName(patch.name) : current.name,
        coverAssetId: patch.coverAssetId === null ? undefined : (patch.coverAssetId ?? current.coverAssetId),
        updatedAt: now(),
      }
      await db.collections.put(next)
      return next
    }),
  )
}

/** Save a new order: `ids` from first to last. */
export async function reorderCollections(ids: Id[]): Promise<void> {
  return guardWrite(() =>
    db.transaction('rw', db.collections, async () => {
      const all = await db.collections.orderBy('sortOrder').toArray()
      const rank = new Map(ids.map((id, i) => [id, i]))
      const ordered = [...all].sort((a, b) => (rank.get(a.id) ?? ids.length + a.sortOrder) - (rank.get(b.id) ?? ids.length + b.sortOrder))
      const t = now()
      await db.collections.bulkPut(ordered.map((c, i) => (c.sortOrder === i ? c : { ...c, sortOrder: i, updatedAt: t })))
    }),
  )
}

/** Deleting a collection never deletes its recipes; they just leave it. */
export async function deleteCollection(id: Id): Promise<void> {
  return guardWrite(() =>
    db.transaction('rw', db.collections, db.recipes, async () => {
      const t = now()
      await db.recipes
        .where('collectionIds')
        .equals(id)
        .modify((r) => {
          r.collectionIds = r.collectionIds.filter((c) => c !== id)
          r.updatedAt = t
        })
      await db.collections.delete(id)
    }),
  )
}

export async function setRecipeInCollection(recipeId: Id, collectionId: Id, member: boolean): Promise<void> {
  return guardWrite(() =>
    db.transaction('rw', db.collections, db.recipes, async () => {
      if (!(await db.collections.get(collectionId))) throw new RecordNotFoundError('Collection', collectionId)
      const recipe = await db.recipes.get(recipeId)
      if (!recipe) throw new RecordNotFoundError('Recipe', recipeId)
      const has = recipe.collectionIds.includes(collectionId)
      if (has === member) return
      await db.recipes.update(recipeId, {
        collectionIds: member ? [...recipe.collectionIds, collectionId] : recipe.collectionIds.filter((c) => c !== collectionId),
        updatedAt: now(),
      })
    }),
  )
}
