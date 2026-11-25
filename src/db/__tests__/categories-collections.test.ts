import { describe, expect, it } from 'vitest'
import {
  ValidationError,
  builtInCategoryId,
  createCategory,
  createCollection,
  createRecipe,
  deleteCategory,
  deleteCollection,
  getRecipe,
  listCategories,
  listCollections,
  listRecipes,
  reorderCategories,
  reorderCollections,
  setRecipeInCollection,
  updateCategory,
} from '@/db'

describe('categories', () => {
  it('adds custom categories at the end', async () => {
    const c = await createCategory({ name: ' Vegan ' })
    const all = await listCategories()
    expect(all.at(-1)).toEqual(c)
    expect(c.name).toBe('Vegan')
    expect(c.builtIn).toBe(false)
  })

  it('renames built-in categories but never deletes them', async () => {
    const id = builtInCategoryId('Other')
    expect((await updateCategory(id, { name: 'Misc' })).name).toBe('Misc')
    await expect(deleteCategory(id)).rejects.toBeInstanceOf(ValidationError)
  })

  it('leaves recipes uncategorized when their custom category is deleted', async () => {
    const c = await createCategory({ name: 'Vegan' })
    const r = await createRecipe({ name: 'Tofu', categoryId: c.id })
    await deleteCategory(c.id)
    expect((await getRecipe(r.id))!.categoryId).toBeUndefined()
    expect((await listCategories()).some((x) => x.id === c.id)).toBe(false)
  })

  it('reorders', async () => {
    const before = await listCategories()
    const last = before.at(-1)!
    await reorderCategories([last.id])
    const after = await listCategories()
    expect(after[0].id).toBe(last.id)
    expect(after.slice(1).map((c) => c.id)).toEqual(before.slice(0, -1).map((c) => c.id))
  })
})

describe('collections', () => {
  it('lets a recipe belong to several collections', async () => {
    const fam = await createCollection({ name: 'Family recipes' })
    const quick = await createCollection({ name: 'Quick meals' })
    const r = await createRecipe({ name: 'Omelette' })
    await setRecipeInCollection(r.id, fam.id, true)
    await setRecipeInCollection(r.id, quick.id, true)
    await setRecipeInCollection(r.id, quick.id, true)
    expect((await getRecipe(r.id))!.collectionIds).toEqual([fam.id, quick.id])
    expect((await listRecipes({ collectionId: quick.id })).map((x) => x.id)).toEqual([r.id])
    await setRecipeInCollection(r.id, fam.id, false)
    expect((await getRecipe(r.id))!.collectionIds).toEqual([quick.id])
  })

  it('deleting a collection keeps its recipes', async () => {
    const c = await createCollection({ name: 'To try' })
    const r = await createRecipe({ name: 'Ramen', collectionIds: [c.id] })
    await deleteCollection(c.id)
    expect((await getRecipe(r.id))!.collectionIds).toEqual([])
    expect(await listCollections()).toEqual([])
  })

  it('reorders', async () => {
    const a = await createCollection({ name: 'A' })
    const b = await createCollection({ name: 'B' })
    await reorderCollections([b.id, a.id])
    expect((await listCollections()).map((c) => c.name)).toEqual(['B', 'A'])
  })
})
