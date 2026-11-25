import { describe, expect, it } from 'vitest'
import {
  ValidationError,
  RecordNotFoundError,
  builtInCategoryId,
  createDesign,
  createRecipe,
  db,
  deleteRecipe,
  duplicateRecipe,
  getAsset,
  getRecipe,
  listDesigns,
  listRecipes,
  setFavorite,
  totalMinutes,
  updateRecipe,
} from '@/db'
import { canvasWith, makeAsset } from '@/test/fixtures'

const tick = () => new Promise((r) => setTimeout(r, 2))

describe('recipes', () => {
  it('creates a recipe with defaults, ids and timestamps', async () => {
    const r = await createRecipe({
      name: '  Pancakes ',
      ingredients: [{ qty: 200, unit: 'g', name: 'flour' }, { unit: '', name: '  ' }],
      steps: [{ text: 'Mix' }, { text: '' }],
      tags: ['quick', ' quick', 'sweet', ''],
    })
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(r.name).toBe('Pancakes')
    expect(r.difficulty).toBe('medium')
    expect(r.favorite).toBe(0)
    expect(r.ingredients).toHaveLength(1)
    expect(r.ingredients[0].id).toBeTruthy()
    expect(r.steps.map((s) => s.text)).toEqual(['Mix'])
    expect(r.tags).toEqual(['quick', 'sweet'])
    expect(r.createdAt).toBe(r.updatedAt)
    expect(await getRecipe(r.id)).toEqual(r)
  })

  it('rejects bad input', async () => {
    await expect(createRecipe({ name: '   ' })).rejects.toBeInstanceOf(ValidationError)
    await expect(createRecipe({ name: 'x', servings: -1 })).rejects.toBeInstanceOf(ValidationError)
    await expect(createRecipe({ name: 'x', prepMin: Number.NaN })).rejects.toBeInstanceOf(ValidationError)
    await expect(updateRecipe('missing', { name: 'x' })).rejects.toBeInstanceOf(RecordNotFoundError)
  })

  it('keeps the main photo inside photoAssetIds', async () => {
    const r = await createRecipe({ name: 'x', photoAssetId: 'a', photoAssetIds: ['b'] })
    expect(r.photoAssetIds).toEqual(['a', 'b'])
    const r2 = await createRecipe({ name: 'y', photoAssetIds: ['c', 'd'] })
    expect(r2.photoAssetId).toBe('c')
  })

  it('updates, bumps updatedAt and keeps createdAt', async () => {
    const r = await createRecipe({ name: 'Soup', tags: ['warm'] })
    await tick()
    const u = await updateRecipe(r.id, { description: 'Hearty', servings: 4 })
    expect(u.createdAt).toBe(r.createdAt)
    expect(u.updatedAt).toBeGreaterThan(r.updatedAt)
    expect(u.tags).toEqual(['warm'])
    expect(u.servings).toBe(4)
  })

  it('computes total time', () => {
    expect(totalMinutes({ prepMin: 10, cookMin: 20 })).toBe(30)
    expect(totalMinutes({ prepMin: 10 })).toBe(10)
    expect(totalMinutes({ prepMin: 10, cookMin: 20, totalOverride: 45 })).toBe(45)
    expect(totalMinutes({})).toBeUndefined()
  })

  it('filters, searches and sorts', async () => {
    const dinner = builtInCategoryId('Dinner')
    const a = await createRecipe({ name: 'banana bread', categoryId: builtInCategoryId('Bakery'), tags: ['sweet'] })
    await tick()
    const b = await createRecipe({ name: 'Apple pie', tags: ['sweet'], favorite: true })
    await tick()
    const c = await createRecipe({ name: 'Chili', categoryId: dinner, ingredients: [{ unit: '', name: 'Kidney beans' }] })

    expect((await listRecipes()).map((r) => r.id)).toEqual([c.id, b.id, a.id])
    expect((await listRecipes({ sort: 'name' })).map((r) => r.name)).toEqual(['Apple pie', 'banana bread', 'Chili'])
    expect((await listRecipes({ categoryId: dinner })).map((r) => r.id)).toEqual([c.id])
    expect((await listRecipes({ favoritesOnly: true })).map((r) => r.id)).toEqual([b.id])
    expect((await listRecipes({ tag: 'sweet', sort: 'created' })).map((r) => r.id)).toEqual([b.id, a.id])
    expect((await listRecipes({ search: 'BEANS' })).map((r) => r.id)).toEqual([c.id])
    expect((await listRecipes({ tag: 'sweet', favoritesOnly: true })).map((r) => r.id)).toEqual([b.id])
  })

  it('toggles favorite', async () => {
    const r = await createRecipe({ name: 'x' })
    expect((await setFavorite(r.id, true)).favorite).toBe(1)
    expect((await setFavorite(r.id, false)).favorite).toBe(0)
  })

  it('deletes a recipe, its designs and its unused photos, but not shared or library assets', async () => {
    const own = await makeAsset()
    const shared = await makeAsset()
    const sticker = await makeAsset({ kind: 'sticker' })
    const r = await createRecipe({ name: 'x', photoAssetIds: [own.id, shared.id] })
    await createRecipe({ name: 'y', photoAssetIds: [shared.id] })
    await createDesign({ recipeId: r.id, preset: '4x6', width: 1800, height: 1200, canvas: canvasWith(sticker.id) })

    await deleteRecipe(r.id)

    expect(await getRecipe(r.id)).toBeUndefined()
    expect(await listDesigns(r.id)).toEqual([])
    expect(await getAsset(own.id)).toBeUndefined()
    expect(await getAsset(shared.id)).toBeDefined()
    expect(await getAsset(sticker.id)).toBeDefined()
  })

  it('removes a photo dropped from a recipe when nothing else uses it', async () => {
    const p1 = await makeAsset()
    const p2 = await makeAsset()
    const r = await createRecipe({ name: 'x', photoAssetIds: [p1.id, p2.id] })
    const u = await updateRecipe(r.id, { photoAssetIds: [p2.id] })
    expect(u.photoAssetId).toBe(p2.id)
    expect(await getAsset(p1.id)).toBeUndefined()
    expect(await getAsset(p2.id)).toBeDefined()
  })

  it('duplicates a recipe with its designs and remaps the primary design', async () => {
    const photo = await makeAsset()
    const r = await createRecipe({ name: 'Tart', photoAssetIds: [photo.id], ingredients: [{ unit: 'g', name: 'butter' }] })
    const d = await createDesign({ recipeId: r.id, preset: '4x6', width: 1800, height: 1200, canvas: canvasWith() })

    const copy = await duplicateRecipe(r.id)
    const copyDesigns = await listDesigns(copy.id)

    expect(copy.id).not.toBe(r.id)
    expect(copy.name).toBe('Tart (copy)')
    expect(copy.ingredients[0].id).not.toBe(r.ingredients[0].id)
    expect(copy.photoAssetIds).toEqual([photo.id])
    expect(copyDesigns).toHaveLength(1)
    expect(copyDesigns[0].id).not.toBe(d.id)
    expect(copy.primaryDesignId).toBe(copyDesigns[0].id)
    expect(await db.assets.count()).toBe(1)
  })
})
