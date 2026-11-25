import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'
import { createCard, deselect, seedRecipe, storedDesign, waitForEditor, waitSaved } from './helpers'

/** A 400×400 PNG: transparent except a solid green disc in the middle (like a tablet drawing). */
async function drawingPng() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="100" fill="#2f7d32"/></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function photoJpg(w = 3000, h = 2000) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 90, b: 40 } } }).jpeg().toBuffer()
}

type Img = { type: string; assetId?: string; binding?: string; cropX: number; cropY: number; width: number; height: number; clipPath?: unknown; radius?: number; getScaledWidth(): number }
const images = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __cardEditor: { canvas: { getObjects(): Img[] } } }).__cardEditor.canvas
      .getObjects()
      .filter((o) => o.type === 'image')
      .map((o) => ({ assetId: o.assetId, binding: o.binding, cropX: o.cropX, width: o.width, height: o.height, radius: o.radius, clipped: !!o.clipPath })),
  )

test.describe('Asset import and library', () => {
  test('a transparent drawing imports into the Library once and keeps its alpha', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'Your drawings live here' })).toBeVisible()
    const png = await drawingPng()
    await page.getByLabel('Import images').setInputFiles({ name: 'lemon_sketch.png', mimeType: 'image/png', buffer: png })
    const tile = page.getByRole('button', { name: 'lemon sketch' })
    await expect(tile).toBeVisible()

    // Same file again is not stored twice.
    await page.getByLabel('Import').setInputFiles({ name: 'again.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByText(/already in your library/)).toBeVisible()
    const stored = await page.evaluate(async () => {
      const db = await import('/src/db/index.ts')
      const all = await db.listAssets()
      const a = all[0]
      const bmp = await createImageBitmap(a.blob)
      const c = new OffscreenCanvas(bmp.width, bmp.height)
      const g = c.getContext('2d')!
      g.drawImage(bmp, 0, 0)
      return { count: all.length, kind: a.kind, mime: a.mime, w: a.width, corner: g.getImageData(5, 5, 1, 1).data[3], centre: [...g.getImageData(200, 200, 1, 1).data] }
    })
    expect(stored).toMatchObject({ count: 1, kind: 'illustration', mime: 'image/png', w: 400, corner: 0 })
    expect(stored.centre).toEqual([47, 125, 50, 255])

    // Detail sheet: rename, retag, change kind.
    await tile.click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('textbox').first().fill('Lemon')
    await sheet.getByRole('textbox').first().press('Enter')
    await sheet.getByRole('radio', { name: 'Sticker' }).click()
    await expect(sheet.getByRole('radio', { name: 'Sticker' })).toHaveAttribute('aria-checked', 'true')
    await expect(sheet).toContainText('PNG · 400 × 400')
    await sheet.getByRole('button', { name: 'Close' }).click()
    await expect.poll(() => page.evaluate(async () => (await (await import('/src/db/index.ts')).listAssets())[0]).then((a) => [a.name, a.kind])).toEqual(['Lemon', 'sticker'])
    expect(errors).toEqual([])
  })

  test('HEIC and other files get a clear message', async ({ page }) => {
    await page.goto('/library')
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(32)])
    await page.getByLabel('Import images').setInputFiles([{ name: 'IMG_0042.HEIC', mimeType: 'image/heic', buffer: heic }])
    await expect(page.getByText(/HEIC photos can’t be opened here/)).toBeVisible()
  })

  test('a drawing placed on a card is stored by id, renders with transparency, and blocks deletion', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    const id = await createCard(page, recipeId, { blank: true })
    await page.getByRole('button', { name: 'Images' }).click()
    await page.getByLabel('Import drawings or images').setInputFiles({ name: 'leaf.png', mimeType: 'image/png', buffer: await drawingPng() })
    await expect.poll(async () => (await images(page)).length).toBe(1)
    await waitSaved(page)

    const design = await storedDesign(page, id)
    const json = JSON.stringify(design!.canvas)
    expect(json).not.toMatch(/blob:|data:image/)
    const assetId = (await images(page))[0].assetId!
    expect(design!.assetIds).toEqual([assetId])

    // Offscreen render: card colour shows through the transparent corners; the disc is green.
    const px = await page.evaluate(async (designId) => {
      const db = await import('/src/db/index.ts')
      const { renderDoc } = await import('/src/features/editor/fabric/render.ts')
      const d = (await db.getDesign(designId))!
      const c = await renderDoc(d.canvas, d, undefined, { width: d.width })
      const g = c.getContext('2d')!
      const ed = (window as unknown as { __cardEditor: { canvas: { getObjects(): { getBoundingRect(): { left: number; top: number; width: number; height: number } }[] } } }).__cardEditor
      const r = ed.canvas.getObjects()[0].getBoundingRect()
      const at = (x: number, y: number) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data]
      return { corner: at(r.left + 3, r.top + 3), centre: at(r.left + r.width / 2, r.top + r.height / 2) }
    }, id)
    expect(px.corner).toEqual([255, 250, 242, 255]) // default card colour #fffaf2
    expect(px.centre[1]).toBeGreaterThan(px.centre[0] + 50)

    await page.goto('/library')
    await page.getByRole('button', { name: 'leaf' }).click()
    await expect(page.getByText('Used in 1 place')).toBeVisible()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  test('photos: recipe photo frame, crop, rounded corners and background, kept after reload', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    // Give the recipe a photo through the importer, like the recipe form does.
    const jpg = await photoJpg()
    await page.evaluate(
      async ({ rid, b64 }) => {
        const db = await import('/src/db/index.ts')
        const { preparePhoto } = await import('/src/features/recipes/photo.ts')
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        const p = await preparePhoto(new File([bytes], 'plums.jpg', { type: 'image/jpeg' }))
        const { asset } = await db.addAsset({ kind: 'photo', ...p })
        await db.updateRecipe(rid, { photoAssetId: asset.id, photoAssetIds: [asset.id] })
      },
      { rid: recipeId, b64: jpg.toString('base64') },
    )
    const id = await createCard(page, recipeId, { blank: true })

    await page.getByRole('button', { name: 'Photos' }).click()
    await page.getByRole('button', { name: /Add recipe photo/ }).click()
    await expect.poll(async () => (await images(page))[0]?.binding).toBe('recipe.photo')
    let [frame] = await images(page)
    expect(frame.width).toBe(2560) // downscaled from 3000 px on import
    expect(frame.assetId).toBeUndefined()

    // Crop to a circle, then zoom in and move left.
    if (!(await page.getByRole('button', { name: 'Circle' }).isVisible())) await page.getByRole('button', { name: 'Crop' }).click()
    await page.getByRole('button', { name: 'Circle' }).click()
    ;[frame] = await images(page)
    expect(frame.width).toBeCloseTo(frame.height, 3)
    expect(frame.radius).toBe(0.5)
    expect(frame.clipped).toBe(true)
    await waitSaved(page)

    const design = await storedDesign(page, id)
    const obj = (design!.canvas as { objects: Record<string, unknown>[] }).objects[0]
    expect(obj).toMatchObject({ binding: 'recipe.photo', radius: 0.5, src: '', crop: { aspect: 1 } })
    expect(obj.assetId).toBeUndefined()
    expect(design!.assetIds).toEqual([])

    // A different recipe photo flows into the same frame and keeps the square crop.
    await page.evaluate(
      async ({ rid, b64 }) => {
        const db = await import('/src/db/index.ts')
        const { preparePhoto } = await import('/src/features/recipes/photo.ts')
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        const p = await preparePhoto(new File([bytes], 'tall.jpg', { type: 'image/jpeg' }))
        const { asset } = await db.addAsset({ kind: 'photo', ...p })
        await db.updateRecipe(rid, { photoAssetId: asset.id, photoAssetIds: [asset.id] })
      },
      { rid: recipeId, b64: (await photoJpg(900, 1600)).toString('base64') },
    )
    await expect.poll(async () => (await images(page))[0].width).toBe(900)
    ;[frame] = await images(page)
    expect(frame.height).toBe(900)

    // Upload a background photo.
    await deselect(page)
    await page.getByRole('button', { name: 'Background' }).click()
    await page.getByLabel('Upload a background').setInputFiles({ name: 'linen.jpg', mimeType: 'image/jpeg', buffer: await photoJpg(1200, 1600) })
    await expect(page.getByRole('radio', { name: 'Fill' })).toBeVisible()
    await page.getByRole('radio', { name: 'Tile' }).click()
    await waitSaved(page)

    await page.reload()
    await waitForEditor(page)
    ;[frame] = await images(page)
    expect(frame).toMatchObject({ binding: 'recipe.photo', width: 900, height: 900, radius: 0.5, clipped: true })
    const bg = await page.evaluate(() => (window as unknown as { __cardEditor: { page: { background: { image?: { fit: string } } } } }).__cardEditor.page.background.image)
    expect(bg?.fit).toBe('tile')
    const stored = await storedDesign(page, id)
    expect(stored!.assetIds).toHaveLength(1)
  })
})
