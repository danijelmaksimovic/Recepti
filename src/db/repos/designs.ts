import type { CanvasJSON, Design, Id } from '@/domain/types'
import { db } from '../schema'
import { RecordNotFoundError, ValidationError, guardWrite } from '../errors'
import { extractAssetIds, newId, now } from '../util'

export interface DesignInput {
  recipeId: Id
  name?: string
  templateId?: Id
  preset: string
  width: number
  height: number
  canvas: CanvasJSON
  thumb?: Blob
}

export type DesignPatch = Partial<Pick<Design, 'name' | 'preset' | 'width' | 'height' | 'canvas' | 'thumb' | 'templateId'>>

function checkSize(width: number, height: number) {
  if (!(width > 0 && height > 0)) throw new ValidationError('Design size must be positive')
}

/** Create a design for a recipe. The recipe's first design becomes its primary one. */
export async function createDesign(input: DesignInput): Promise<Design> {
  checkSize(input.width, input.height)
  return guardWrite(() =>
    db.transaction('rw', db.recipes, db.designs, async () => {
      const recipe = await db.recipes.get(input.recipeId)
      if (!recipe) throw new RecordNotFoundError('Recipe', input.recipeId)
      const t = now()
      const design: Design = {
        id: newId(),
        recipeId: input.recipeId,
        name: input.name?.trim() || 'Card',
        templateId: input.templateId,
        preset: input.preset,
        width: input.width,
        height: input.height,
        canvas: input.canvas,
        assetIds: extractAssetIds(input.canvas),
        thumb: input.thumb,
        createdAt: t,
        updatedAt: t,
      }
      await db.designs.add(design)
      if (!recipe.primaryDesignId) await db.recipes.update(recipe.id, { primaryDesignId: design.id })
      return design
    }),
  )
}

export function getDesign(id: Id): Promise<Design | undefined> {
  return db.designs.get(id)
}

/** A recipe's designs, most recently edited first. */
export function listDesigns(recipeId: Id): Promise<Design[]> {
  return db.designs.where('recipeId').equals(recipeId).reverse().sortBy('updatedAt')
}

/** Save editor changes. `assetIds` is recomputed from the canvas. */
export async function saveDesign(id: Id, patch: DesignPatch): Promise<Design> {
  return guardWrite(() =>
    db.transaction('rw', db.designs, async () => {
      const current = await db.designs.get(id)
      if (!current) throw new RecordNotFoundError('Design', id)
      const next: Design = { ...current, ...patch, updatedAt: now() }
      next.name = next.name.trim() || current.name
      checkSize(next.width, next.height)
      next.assetIds = extractAssetIds(next.canvas)
      await db.designs.put(next)
      return next
    }),
  )
}

export async function duplicateDesign(id: Id): Promise<Design> {
  return guardWrite(() =>
    db.transaction('rw', db.designs, async () => {
      const src = await db.designs.get(id)
      if (!src) throw new RecordNotFoundError('Design', id)
      const t = now()
      const copy: Design = { ...structuredClone(src), id: newId(), name: `${src.name} (copy)`, createdAt: t, updatedAt: t }
      await db.designs.add(copy)
      return copy
    }),
  )
}

export async function setPrimaryDesign(recipeId: Id, designId: Id): Promise<void> {
  return guardWrite(() =>
    db.transaction('rw', db.recipes, db.designs, async () => {
      const design = await db.designs.get(designId)
      if (!design || design.recipeId !== recipeId) throw new RecordNotFoundError('Design', designId)
      const updated = await db.recipes.update(recipeId, { primaryDesignId: designId })
      if (!updated) throw new RecordNotFoundError('Recipe', recipeId)
    }),
  )
}

/**
 * Delete a design. If it was the primary one, the most recently edited
 * remaining design takes over. Assets it used stay in the library.
 */
export async function deleteDesign(id: Id): Promise<void> {
  return guardWrite(() =>
    db.transaction('rw', db.recipes, db.designs, async () => {
      const design = await db.designs.get(id)
      if (!design) return
      await db.designs.delete(id)
      const recipe = await db.recipes.get(design.recipeId)
      if (recipe?.primaryDesignId === id) {
        const rest = await db.designs.where('recipeId').equals(recipe.id).reverse().sortBy('updatedAt')
        await db.recipes.update(recipe.id, { primaryDesignId: rest[0]?.id })
      }
    }),
  )
}
