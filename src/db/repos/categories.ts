import type { Category, Id } from '@/domain/types'
import { db } from '../schema'
import { RecordNotFoundError, ValidationError, guardWrite } from '../errors'
import { newId, now } from '../util'

export function listCategories(): Promise<Category[]> {
  return db.categories.orderBy('sortOrder').toArray()
}

export function getCategory(id: Id): Promise<Category | undefined> {
  return db.categories.get(id)
}

function cleanName(name: string): string {
  const n = name.trim()
  if (!n) throw new ValidationError('Category needs a name')
  return n
}

export async function createCategory(input: { name: string; icon?: string }): Promise<Category> {
  return guardWrite(() =>
    db.transaction('rw', db.categories, async () => {
      const last = await db.categories.orderBy('sortOrder').last()
      const t = now()
      const category: Category = {
        id: newId(),
        name: cleanName(input.name),
        icon: input.icon ?? 'tag',
        sortOrder: (last?.sortOrder ?? -1) + 1,
        builtIn: false,
        createdAt: t,
        updatedAt: t,
      }
      await db.categories.add(category)
      return category
    }),
  )
}

/** Built-in categories can be renamed and given a new icon too. */
export async function updateCategory(id: Id, patch: { name?: string; icon?: string }): Promise<Category> {
  return guardWrite(() =>
    db.transaction('rw', db.categories, async () => {
      const current = await db.categories.get(id)
      if (!current) throw new RecordNotFoundError('Category', id)
      const next = {
        ...current,
        name: patch.name !== undefined ? cleanName(patch.name) : current.name,
        icon: patch.icon ?? current.icon,
        updatedAt: now(),
      }
      await db.categories.put(next)
      return next
    }),
  )
}

/** Save a new order: `ids` from first to last. Ids not listed keep their relative order after them. */
export async function reorderCategories(ids: Id[]): Promise<void> {
  return guardWrite(() =>
    db.transaction('rw', db.categories, async () => {
      const all = await db.categories.orderBy('sortOrder').toArray()
      const rank = new Map(ids.map((id, i) => [id, i]))
      const ordered = [...all].sort((a, b) => (rank.get(a.id) ?? ids.length + a.sortOrder) - (rank.get(b.id) ?? ids.length + b.sortOrder))
      const t = now()
      await db.categories.bulkPut(ordered.map((c, i) => (c.sortOrder === i ? c : { ...c, sortOrder: i, updatedAt: t })))
    }),
  )
}

/** Only custom categories can be deleted. Recipes in it become uncategorized. */
export async function deleteCategory(id: Id): Promise<void> {
  return guardWrite(() =>
    db.transaction('rw', db.categories, db.recipes, async () => {
      const current = await db.categories.get(id)
      if (!current) return
      if (current.builtIn) throw new ValidationError('Built-in categories cannot be deleted')
      const t = now()
      await db.recipes
        .where('categoryId')
        .equals(id)
        .modify((r) => {
          delete r.categoryId
          r.updatedAt = t
        })
      await db.categories.delete(id)
    }),
  )
}
