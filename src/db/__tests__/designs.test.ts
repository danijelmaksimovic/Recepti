import { describe, expect, it } from 'vitest'
import {
  applyTemplate,
  createDesign,
  createRecipe,
  createTemplate,
  deleteDesign,
  duplicateDesign,
  extractAssetIds,
  getDesign,
  getRecipe,
  getTemplate,
  listDesigns,
  saveDesign,
  saveDesignAsTemplate,
  setPrimaryDesign,
  RecordNotFoundError,
} from '@/db'
import { canvasWith } from '@/test/fixtures'

const size = { preset: '4x6', width: 1800, height: 1200 }
const tick = () => new Promise((r) => setTimeout(r, 2))

describe('designs and templates', () => {
  it('extracts asset ids from nested canvas JSON', () => {
    const canvas = {
      backgroundImage: { assetId: 'bg' },
      objects: [{ type: 'group', objects: [{ assetId: 'a' }, { assetId: 'b' }] }, { assetId: 'a' }, { assetId: '' }],
    }
    expect(extractAssetIds(canvas).sort()).toEqual(['a', 'b', 'bg'])
  })

  it('makes the first design primary and keeps later ones secondary', async () => {
    const r = await createRecipe({ name: 'x' })
    const d1 = await createDesign({ recipeId: r.id, ...size, canvas: canvasWith('a') })
    const d2 = await createDesign({ recipeId: r.id, ...size, canvas: canvasWith() })
    expect(d1.assetIds).toEqual(['a'])
    expect((await getRecipe(r.id))!.primaryDesignId).toBe(d1.id)
    await setPrimaryDesign(r.id, d2.id)
    expect((await getRecipe(r.id))!.primaryDesignId).toBe(d2.id)
  })

  it('needs an existing recipe', async () => {
    await expect(createDesign({ recipeId: 'nope', ...size, canvas: {} })).rejects.toBeInstanceOf(RecordNotFoundError)
  })

  it('hands primary to the most recently edited design when the primary is deleted', async () => {
    const r = await createRecipe({ name: 'x' })
    const d1 = await createDesign({ recipeId: r.id, ...size, canvas: {} })
    const d2 = await createDesign({ recipeId: r.id, ...size, canvas: {} })
    await tick()
    const d3 = await createDesign({ recipeId: r.id, ...size, canvas: {} })
    await tick()
    await saveDesign(d2.id, { name: 'Edited' })
    await deleteDesign(d1.id)
    expect((await getRecipe(r.id))!.primaryDesignId).toBe(d2.id)
    await deleteDesign(d2.id)
    expect((await getRecipe(r.id))!.primaryDesignId).toBe(d3.id)
    await deleteDesign(d3.id)
    expect((await getRecipe(r.id))!.primaryDesignId).toBeUndefined()
  })

  it('duplicates a design', async () => {
    const r = await createRecipe({ name: 'x' })
    const d = await createDesign({ recipeId: r.id, name: 'Front', ...size, canvas: canvasWith('a') })
    const copy = await duplicateDesign(d.id)
    expect(copy.name).toBe('Front (copy)')
    expect(copy.assetIds).toEqual(['a'])
    expect(await listDesigns(r.id)).toHaveLength(2)
  })

  it('applying a template copies it, so edits never reach the template', async () => {
    const r = await createRecipe({ name: 'x' })
    const t = await createTemplate({ name: 'Rustic', ...size, canvas: { objects: [{ type: 'textbox', sourceText: '{{recipe.name}}' }] } })
    const d = await applyTemplate(t.id, r.id)
    expect(d.templateId).toBe(t.id)
    expect(d.canvas).toEqual(t.canvas)

    await saveDesign(d.id, { canvas: { objects: [] } })
    expect((await getTemplate(t.id))!.canvas).toEqual(t.canvas)
    expect((await getDesign(d.id))!.canvas).toEqual({ objects: [] })
  })

  it('saves a design as a new template', async () => {
    const r = await createRecipe({ name: 'x' })
    const d = await createDesign({ recipeId: r.id, ...size, canvas: canvasWith('a') })
    const t = await saveDesignAsTemplate(d.id, 'Mine')
    expect(t.name).toBe('Mine')
    expect(t.builtIn).toBe(false)
    expect(t.assetIds).toEqual(['a'])
  })
})
