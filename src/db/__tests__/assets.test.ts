import { describe, expect, it } from 'vitest'
import {
  AssetInUseError,
  addAsset,
  countAssetUsage,
  createCollection,
  createDesign,
  createRecipe,
  createTemplate,
  deleteAsset,
  deleteAssetsIfUnused,
  findUnusedAssets,
  getAsset,
  listAssets,
  saveDesign,
  updateAsset,
} from '@/db'
import { canvasWith, makeAsset } from '@/test/fixtures'

describe('assets', () => {
  it('stores the blob with its hash and size', async () => {
    const blob = new Blob(['hello'], { type: 'image/png' })
    const { asset, deduplicated } = await addAsset({ kind: 'illustration', blob, width: 4, height: 3, name: ' Leaf ', tags: ['green'] })
    expect(deduplicated).toBe(false)
    expect(asset.hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    expect(asset.bytes).toBe(5)
    expect(asset.mime).toBe('image/png')
    expect(asset.name).toBe('Leaf')
    const stored = await getAsset(asset.id)
    expect(await stored!.blob.text()).toBe('hello')
  })

  it('reuses an existing asset for identical bytes', async () => {
    const a = await makeAsset({ bytes: 'same' })
    const { asset, deduplicated } = await addAsset({ kind: 'photo', blob: new Blob(['same']), width: 1, height: 1 })
    expect(deduplicated).toBe(true)
    expect(asset.id).toBe(a.id)
    expect(await listAssets()).toHaveLength(1)
  })

  it('updates metadata and filters by kind', async () => {
    const a = await makeAsset({ kind: 'sticker' })
    await makeAsset({ kind: 'photo' })
    const u = await updateAsset(a.id, { name: 'Star', tags: ['gold', 'gold'] })
    expect(u.tags).toEqual(['gold'])
    expect((await listAssets('sticker')).map((x) => x.id)).toEqual([a.id])
  })

  it('counts usage across recipes, designs, templates and collections', async () => {
    const a = await makeAsset()
    expect(await countAssetUsage(a.id)).toBe(0)
    const r = await createRecipe({ name: 'x', photoAssetIds: [a.id] })
    await createDesign({ recipeId: r.id, preset: '1:1', width: 100, height: 100, canvas: canvasWith(a.id, a.id) })
    await createTemplate({ name: 'T', preset: '1:1', width: 100, height: 100, canvas: { background: { assetId: a.id } } })
    await createCollection({ name: 'C', coverAssetId: a.id })
    expect(await countAssetUsage(a.id)).toBe(4)
  })

  it('refuses to delete an asset in use', async () => {
    const a = await makeAsset()
    const r = await createRecipe({ name: 'x' })
    const d = await createDesign({ recipeId: r.id, preset: '1:1', width: 100, height: 100, canvas: canvasWith(a.id) })
    await expect(deleteAsset(a.id)).rejects.toBeInstanceOf(AssetInUseError)
    expect(await getAsset(a.id)).toBeDefined()

    // Removing it from the canvas releases it: assetIds are recomputed on save.
    await saveDesign(d.id, { canvas: canvasWith() })
    await deleteAsset(a.id)
    expect(await getAsset(a.id)).toBeUndefined()
  })

  it('finds and cleans unused assets only', async () => {
    const used = await makeAsset()
    const unused = await makeAsset({ kind: 'texture' })
    await createRecipe({ name: 'x', photoAssetIds: [used.id] })
    expect((await findUnusedAssets()).map((a) => a.id)).toEqual([unused.id])
    expect(await deleteAssetsIfUnused([used.id, unused.id])).toEqual([unused.id])
    expect(await getAsset(used.id)).toBeDefined()
  })
})

describe('asset usage counts', () => {
  it('counts every place an asset is used, including card backgrounds', async () => {
    const { assetUsageCounts, extractAssetIds } = await import('@/db')
    const photo = await makeAsset()
    const bg = await makeAsset()
    const unused = await makeAsset()
    const recipe = await createRecipe({ name: 'Soup', photoAssetId: photo.id, photoAssetIds: [photo.id] })
    const canvas = { version: 1, background: { color: '#ffffff', image: { assetId: bg.id, fit: 'cover', opacity: 1, tileSize: 0.25 } }, objects: [{ type: 'Image', assetId: photo.id }] }
    expect(extractAssetIds(canvas).sort()).toEqual([photo.id, bg.id].sort())
    await createDesign({ recipeId: recipe.id, preset: 'p', width: 10, height: 10, canvas })
    const counts = await assetUsageCounts()
    expect(counts[photo.id]).toBe(2)
    expect(counts[bg.id]).toBe(1)
    expect(counts[unused.id]).toBeUndefined()
    await expect(deleteAsset(bg.id)).rejects.toBeInstanceOf(AssetInUseError)
  })
})
