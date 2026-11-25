import { Dexie, type EntityTable } from 'dexie'
import type { Asset, Category, Collection, Design, MetaEntry, Recipe, Template } from '@/domain/types'
import { BUILT_IN_CATEGORIES, BUILT_IN_CATEGORY_ICONS } from '@/domain/categories'

export const DB_NAME = 'recipe-book'
export const SCHEMA_VERSION = 1

/**
 * Stable ids for the seeded categories, so the same built-in category has the
 * same id on every device and backups merge cleanly.
 */
export function builtInCategoryId(name: string): string {
  return `builtin-${name.toLowerCase()}`
}

export class RecipeBookDB extends Dexie {
  recipes!: EntityTable<Recipe, 'id'>
  categories!: EntityTable<Category, 'id'>
  collections!: EntityTable<Collection, 'id'>
  assets!: EntityTable<Asset, 'id'>
  designs!: EntityTable<Design, 'id'>
  templates!: EntityTable<Template, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = DB_NAME) {
    super(name)

    // Only indexed fields are listed. Add a new `this.version(n)` block for any
    // change; never edit a published one.
    this.version(1).stores({
      recipes: 'id, name, categoryId, *tags, *collectionIds, *photoAssetIds, favorite, createdAt, updatedAt',
      categories: 'id, sortOrder',
      collections: 'id, sortOrder, createdAt',
      assets: 'id, &hash, kind, *tags, createdAt',
      designs: 'id, recipeId, *assetIds, updatedAt',
      templates: 'id, *assetIds, updatedAt',
      meta: 'key',
    })

    this.on('populate', (tx) => {
      const t = Date.now()
      tx.table('categories').bulkAdd(
        BUILT_IN_CATEGORIES.map<Category>((name, i) => ({
          id: builtInCategoryId(name),
          name,
          icon: BUILT_IN_CATEGORY_ICONS[name],
          sortOrder: i,
          builtIn: true,
          createdAt: t,
          updatedAt: t,
        })),
      )
      tx.table('meta').add({ key: 'schemaVersion', value: SCHEMA_VERSION })
    })
  }
}

/** The app's single database. Only modules in `src/db` may import it. */
export const db = new RecipeBookDB()
