/**
 * Storage layer public API. UI code imports from `@/db` and never from Dexie
 * directly (BLUEPRINT §2).
 */
export { db, RecipeBookDB, DB_NAME, SCHEMA_VERSION, builtInCategoryId } from './schema'
export * from './errors'
export * from './meta'
export * from './storage'
export * from './repos/recipes'
export * from './repos/categories'
export * from './repos/collections'
export * from './repos/assets'
export * from './repos/designs'
export * from './repos/templates'
export { extractAssetIds } from './util'
