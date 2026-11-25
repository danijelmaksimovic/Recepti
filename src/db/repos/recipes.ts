import type { Design, Difficulty, Id, Ingredient, Recipe, Step } from '@/domain/types'
import { db } from '../schema'
import { RecordNotFoundError, ValidationError, guardWrite } from '../errors'
import { cleanList, newId, now } from '../util'
import { deleteUnusedInTx } from './assets'

/** Ingredients and steps may omit `id`; one is generated. */
export type IngredientInput = Omit<Ingredient, 'id'> & { id?: Id }
export type StepInput = Omit<Step, 'id'> & { id?: Id }

export interface RecipeInput {
  name: string
  description?: string
  photoAssetId?: Id
  photoAssetIds?: Id[]
  ingredients?: IngredientInput[]
  steps?: StepInput[]
  prepMin?: number
  cookMin?: number
  totalOverride?: number
  servings?: number
  difficulty?: Difficulty
  categoryId?: Id
  tags?: string[]
  collectionIds?: Id[]
  notes?: string
  favorite?: boolean
}

export type RecipePatch = Partial<RecipeInput>

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

function optNumber(v: number | undefined, field: string): number | undefined {
  if (v === undefined || v === null) return undefined
  if (!Number.isFinite(v) || v < 0) throw new ValidationError(`${field} must be a positive number`)
  return v
}

/** Build a clean, valid Recipe from input merged over an optional existing record. */
function normalize(input: RecipeInput, base: Pick<Recipe, 'id' | 'createdAt' | 'primaryDesignId'>): Recipe {
  const name = input.name?.trim()
  if (!name) throw new ValidationError('Recipe needs a name')
  const difficulty = input.difficulty ?? 'medium'
  if (!DIFFICULTIES.includes(difficulty)) throw new ValidationError(`Unknown difficulty "${difficulty}"`)

  const photoAssetIds = [...new Set(input.photoAssetIds ?? [])]
  const photoAssetId = input.photoAssetId ?? photoAssetIds[0]
  if (photoAssetId && !photoAssetIds.includes(photoAssetId)) photoAssetIds.unshift(photoAssetId)

  return {
    id: base.id,
    name,
    description: input.description?.trim() ?? '',
    photoAssetId,
    photoAssetIds,
    ingredients: (input.ingredients ?? [])
      .filter((i) => i.name?.trim())
      .map((i) => ({
        ...i,
        id: i.id ?? newId(),
        name: i.name.trim(),
        unit: i.unit?.trim() ?? '',
        qty: optNumber(i.qty, 'Quantity'),
      })),
    steps: (input.steps ?? []).filter((s) => s.text?.trim()).map((s) => ({ id: s.id ?? newId(), text: s.text.trim() })),
    prepMin: optNumber(input.prepMin, 'Prep time'),
    cookMin: optNumber(input.cookMin, 'Cook time'),
    totalOverride: optNumber(input.totalOverride, 'Total time'),
    servings: optNumber(input.servings, 'Servings'),
    difficulty,
    categoryId: input.categoryId,
    tags: cleanList(input.tags),
    collectionIds: [...new Set(input.collectionIds ?? [])],
    notes: input.notes ?? '',
    favorite: input.favorite ? 1 : 0,
    primaryDesignId: base.primaryDesignId,
    createdAt: base.createdAt,
    updatedAt: now(),
  }
}

function toInput(r: Recipe): RecipeInput {
  return { ...r, favorite: r.favorite === 1 }
}

/** Total minutes shown to the user: the override if set, else prep + cook. */
export function totalMinutes(r: Pick<Recipe, 'prepMin' | 'cookMin' | 'totalOverride'>): number | undefined {
  if (r.totalOverride !== undefined) return r.totalOverride
  if (r.prepMin === undefined && r.cookMin === undefined) return undefined
  return (r.prepMin ?? 0) + (r.cookMin ?? 0)
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const t = now()
  const recipe = { ...normalize(input, { id: newId(), createdAt: t, primaryDesignId: undefined }), updatedAt: t }
  await guardWrite(() => db.recipes.add(recipe))
  return recipe
}

export function getRecipe(id: Id): Promise<Recipe | undefined> {
  return db.recipes.get(id)
}

export type RecipeSort = 'updated' | 'created' | 'name'

export interface RecipeQuery {
  sort?: RecipeSort
  categoryId?: Id
  collectionId?: Id
  tag?: string
  favoritesOnly?: boolean
  /** Case-insensitive match on name, description, tags and ingredient names. */
  search?: string
}

export async function listRecipes(q: RecipeQuery = {}): Promise<Recipe[]> {
  let coll
  if (q.collectionId) coll = db.recipes.where('collectionIds').equals(q.collectionId)
  else if (q.categoryId) coll = db.recipes.where('categoryId').equals(q.categoryId)
  else if (q.tag) coll = db.recipes.where('tags').equals(q.tag)
  else if (q.favoritesOnly) coll = db.recipes.where('favorite').equals(1)
  else coll = db.recipes.toCollection()

  const needle = q.search?.trim().toLowerCase()
  coll = coll.filter(
    (r) =>
      (!q.categoryId || r.categoryId === q.categoryId) &&
      (!q.tag || r.tags.includes(q.tag)) &&
      (!q.favoritesOnly || r.favorite === 1) &&
      (!needle ||
        r.name.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle) ||
        r.tags.some((t) => t.toLowerCase().includes(needle)) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(needle))),
  )

  const sort = q.sort ?? 'updated'
  if (sort === 'name') {
    const rows = await coll.toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }
  return coll.reverse().sortBy(sort === 'created' ? 'createdAt' : 'updatedAt')
}

/** Photo assets the recipe dropped are deleted if nothing else uses them. */
export async function updateRecipe(id: Id, patch: RecipePatch): Promise<Recipe> {
  return guardWrite(() =>
    db.transaction('rw', [db.recipes, db.assets, db.designs, db.templates, db.collections], async () => {
      const current = await db.recipes.get(id)
      if (!current) throw new RecordNotFoundError('Recipe', id)
      // An explicit `photoAssetIds` without `photoAssetId` must not keep a removed main photo.
      const merged = { ...toInput(current), ...patch }
      if (patch.photoAssetIds && !('photoAssetId' in patch) && current.photoAssetId && !patch.photoAssetIds.includes(current.photoAssetId))
        merged.photoAssetId = undefined
      const next = normalize(merged, current)
      await db.recipes.put(next)
      await deletePhotosIfUnused(current.photoAssetIds.filter((a) => !next.photoAssetIds.includes(a)))
      return next
    }),
  )
}

export function setFavorite(id: Id, favorite: boolean): Promise<Recipe> {
  return updateRecipe(id, { favorite })
}

/** Only `photo` assets are removed automatically; library assets never are (BLUEPRINT §3). */
async function deletePhotosIfUnused(ids: Id[]) {
  if (ids.length === 0) return
  const photos = (await db.assets.bulkGet(ids)).filter((a) => a?.kind === 'photo').map((a) => a!.id)
  await deleteUnusedInTx(photos)
}

/** Delete a recipe and its designs; its photos go too unless used elsewhere. */
export async function deleteRecipe(id: Id): Promise<void> {
  return guardWrite(() =>
    db.transaction('rw', [db.recipes, db.assets, db.designs, db.templates, db.collections], async () => {
      const recipe = await db.recipes.get(id)
      if (!recipe) return
      await db.designs.where('recipeId').equals(id).delete()
      await db.recipes.delete(id)
      await deletePhotosIfUnused(recipe.photoAssetIds)
    }),
  )
}

/** Copy a recipe and all its designs. Assets are shared, not copied. */
export async function duplicateRecipe(id: Id): Promise<Recipe> {
  return guardWrite(() =>
    db.transaction('rw', db.recipes, db.designs, async () => {
      const src = await db.recipes.get(id)
      if (!src) throw new RecordNotFoundError('Recipe', id)
      const t = now()
      const copyId = newId()
      const designs = await db.designs.where('recipeId').equals(id).toArray()
      const idMap = new Map(designs.map((d) => [d.id, newId()]))
      const copies: Design[] = designs.map((d) => ({ ...d, id: idMap.get(d.id)!, recipeId: copyId, createdAt: t, updatedAt: t }))
      const copy: Recipe = {
        ...structuredClone(src),
        id: copyId,
        name: `${src.name} (copy)`,
        ingredients: src.ingredients.map((i) => ({ ...i, id: newId() })),
        steps: src.steps.map((s) => ({ ...s, id: newId() })),
        primaryDesignId: src.primaryDesignId ? idMap.get(src.primaryDesignId) : undefined,
        createdAt: t,
        updatedAt: t,
      }
      await db.recipes.add(copy)
      await db.designs.bulkAdd(copies)
      return copy
    }),
  )
}
