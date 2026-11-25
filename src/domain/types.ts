/**
 * Persisted record shapes (BLUEPRINT §3).
 *
 * Every record has a UUID `id` plus `createdAt` / `updatedAt` (ms since epoch)
 * so a sync layer can be added later without migrating ids.
 */

export type Id = string
/** Milliseconds since the Unix epoch. */
export type Timestamp = number

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Ingredient {
  id: Id
  qty?: number
  unit: string
  name: string
  note?: string
  /** Optional sub-heading, e.g. "For the sauce". */
  group?: string
}

export interface Step {
  id: Id
  text: string
}

export interface Recipe {
  id: Id
  name: string
  description: string
  /** Main photo. Always also present in `photoAssetIds`. */
  photoAssetId?: Id
  photoAssetIds: Id[]
  ingredients: Ingredient[]
  steps: Step[]
  prepMin?: number
  cookMin?: number
  /** Overrides prepMin + cookMin when set. */
  totalOverride?: number
  servings?: number
  difficulty: Difficulty
  categoryId?: Id
  tags: string[]
  collectionIds: Id[]
  notes: string
  /** 0 | 1 so it can be indexed (IndexedDB cannot index booleans). */
  favorite: 0 | 1
  primaryDesignId?: Id
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Category {
  id: Id
  name: string
  icon: string
  sortOrder: number
  builtIn: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Collection {
  id: Id
  name: string
  coverAssetId?: Id
  sortOrder: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type AssetKind = 'photo' | 'illustration' | 'sticker' | 'background' | 'texture' | 'drawing'

export interface Asset {
  id: Id
  kind: AssetKind
  blob: Blob
  thumb?: Blob
  mime: string
  width: number
  height: number
  bytes: number
  /** Hex SHA-256 of `blob`; unique, used for de-duplication. */
  hash: string
  name: string
  tags: string[]
  /** Re-editable strokes for sketch-pad drawings. */
  sketchData?: unknown
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Fabric.js canvas JSON. Kept opaque to the storage layer. */
export type CanvasJSON = Record<string, unknown>

export interface Design {
  id: Id
  recipeId: Id
  name: string
  templateId?: Id
  preset: string
  width: number
  height: number
  canvas: CanvasJSON
  /** Derived from `canvas` on every save; never set by callers. */
  assetIds: Id[]
  thumb?: Blob
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Template {
  id: Id
  name: string
  builtIn: boolean
  preset: string
  width: number
  height: number
  canvas: CanvasJSON
  /** Derived from `canvas` on every save; never set by callers. */
  assetIds: Id[]
  thumb?: Blob
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface MetaEntry {
  key: string
  value: unknown
}
