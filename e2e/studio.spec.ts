import { expect, test } from '@playwright/test'
import { canvasTexts, createCard, deselect, seedRecipe, selectText, storedDesign, waitSaved } from './helpers'

test.describe('Design Studio', () => {
  test('a new card shows the recipe through fields and stores only tokens', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const recipeId = await seedRecipe(page)
    const id = await createCard(page, recipeId)

    const texts = await canvasTexts(page)
    expect(texts).toContain('Plum cake with walnuts')
    expect(texts.join('\n')).toContain('• 200 g flour')
    expect(texts.join('\n')).toContain('1. Cream butter and sugar.')
    expect(texts.join('\n')).toMatch(/1 h 15 min\s+·\s+Serves 8/)

    const design = await storedDesign(page, id)
    const json = JSON.stringify(design!.canvas)
    expect(json).toContain('{{recipe.name}}')
    expect(json).not.toContain('Plum cake')
    expect(json).not.toContain('200 g flour')
    expect((design!.canvas as { version: number }).version).toBe(1)
    expect(design!.thumb).toBeGreaterThan(1000)
    expect(errors).toEqual([])
  })

  test('the same design follows recipe edits', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    await createCard(page, recipeId)
    await page.evaluate(async (rid) => {
      const db = await import('/src/db/index.ts')
      await db.updateRecipe(rid, { name: 'Šljiva torta', servings: 12 })
    }, recipeId)
    await expect.poll(() => canvasTexts(page)).toContain('Šljiva torta')
    expect((await canvasTexts(page)).join('\n')).toContain('Serves 12')
  })

  test('text, fields and background changes persist after reload', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    const id = await createCard(page, recipeId, { blank: true })
    expect(await canvasTexts(page)).toEqual([])

    await page.getByRole('button', { name: 'Fields' }).click()
    await page.getByRole('button', { name: /^Servings/ }).click()
    await deselect(page)
    await page.getByRole('button', { name: 'Text', exact: true }).click()
    await page.getByRole('button', { name: 'Add a heading' }).click()
    await expect.poll(() => canvasTexts(page)).toEqual(['8', 'Your heading'])

    // Edit the heading to mix literal text with a field, and restyle it.
    await selectText(page, 'Your heading')
    const box = page.getByRole('textbox', { name: 'Text' })
    if (!(await box.isVisible())) await page.getByRole('button', { name: 'Edit' }).click()
    await box.fill('Serves {{recipe.servings}} people')
    await expect.poll(() => canvasTexts(page)).toContain('Serves 8 people')
    if (!(await page.getByRole('button', { name: /Caveat/ }).isVisible())) await page.getByRole('button', { name: 'Style' }).click()
    await page.getByRole('button', { name: /Caveat/ }).click()

    // Background: colour and texture.
    await deselect(page)
    await page.getByRole('button', { name: 'Background' }).click()
    await page.getByRole('button', { name: '#5f6e42' }).first().click()
    await page.getByRole('button', { name: 'Gingham' }).click()
    await waitSaved(page)

    const stored = await storedDesign(page, id)
    const doc = stored!.canvas as { background: { color: string; texture: string }; objects: { sourceText?: string; fontFamily?: string; text?: string }[] }
    expect(doc.background).toMatchObject({ color: '#5f6e42', texture: 'gingham' })
    const heading = doc.objects.find((o) => o.sourceText?.startsWith('Serves'))!
    expect(heading).toMatchObject({ sourceText: 'Serves {{recipe.servings}} people', text: 'Serves {{recipe.servings}} people', fontFamily: 'Caveat' })

    await page.reload()
    await page.waitForFunction(() => !!(window as unknown as { __cardEditor?: unknown }).__cardEditor)
    await expect.poll(() => canvasTexts(page)).toEqual(['8', 'Serves 8 people'])
    const bg = await page.evaluate(() => (window as unknown as { __cardEditor: { page: { background: { texture: string } } } }).__cardEditor.page.background.texture)
    expect(bg).toBe('gingham')
  })

  test('canvas size and orientation can change after creation', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    const id = await createCard(page, recipeId)
    expect(await storedDesign(page, id)).toMatchObject({ preset: 'print-4x6', width: 1200, height: 1800 })
    await page.getByRole('button', { name: 'Canvas' }).click()
    await page.getByRole('radio', { name: 'Landscape' }).click()
    await waitSaved(page)
    expect(await storedDesign(page, id)).toMatchObject({ width: 1800, height: 1200 })
    await page.getByRole('button', { name: /Square 1:1/ }).click()
    await waitSaved(page)
    expect(await storedDesign(page, id)).toMatchObject({ preset: 'digital-1x1', width: 1080, height: 1080 })
  })

  test('zoom is view-only: buttons, fit and grid', async ({ page, isMobile }) => {
    const recipeId = await seedRecipe(page)
    const id = await createCard(page, recipeId)
    const zoomLabel = page.getByRole('button', { name: /^\d+%$|Fit to screen/ }).filter({ visible: true }).first()
    const fitText = await zoomLabel.innerText()
    if (!isMobile) {
      await page.getByRole('button', { name: 'Zoom in' }).click()
      await expect(zoomLabel).not.toHaveText(fitText)
      await zoomLabel.click()
      await expect(zoomLabel).toHaveText(fitText)
    }
    if (isMobile) {
      // Phones keep the grid switch in the Canvas panel to leave room for undo/redo in the top bar.
      await page.getByRole('button', { name: 'Canvas' }).click()
      await page.getByRole('switch', { name: 'Show grid' }).click()
      await expect(page.getByRole('switch', { name: 'Show grid' })).toHaveAttribute('aria-checked', 'true')
    } else {
      await page.getByRole('button', { name: 'Show grid' }).click()
      await expect(page.getByRole('button', { name: 'Hide grid' })).toBeVisible()
    }
    const d = await storedDesign(page, id)
    expect(d).toMatchObject({ width: 1200, height: 1800 })
  })

  test('cards are listed on the recipe and in the Studio, and can be deleted', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    await createCard(page, recipeId)
    await page.getByRole('button', { name: 'Back to recipe' }).click()
    await expect(page.getByRole('button', { name: /Open Recipe card 4×6″/ })).toBeVisible()
    await page.goto('/studio')
    await expect(page.getByRole('link', { name: /Plum cake with walnuts/ }).first()).toBeVisible()
    await page.goto(`/recipes/${recipeId}`)
    await page.getByRole('button', { name: /More for Recipe card/ }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete card' }).click()
    await expect(page.getByRole('button', { name: /Open Recipe card 4×6″/ })).toHaveCount(0)
  })
})

test.describe('Design Studio on touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch only')

  test('tap selects text and the style sheet changes it', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    await createCard(page, recipeId, { preset: /Social 4:5/ })
    const host = page.getByTestId('canvas-host')
    const b = (await host.boundingBox())!
    // The recipe name sits in the upper part of the card.
    const pos = await page.evaluate(() => {
      type O = { text?: string; getCenterPoint(): { x: number; y: number } }
      const ed = (window as unknown as { __cardEditor: { canvas: { getObjects(): O[]; viewportTransform: number[] } } }).__cardEditor
      const o = ed.canvas.getObjects().find((x) => x.text === 'Plum cake with walnuts')!
      const c = o.getCenterPoint()
      const v = ed.canvas.viewportTransform
      return { x: c.x * v[0] + v[4], y: c.y * v[3] + v[5] }
    })
    await page.touchscreen.tap(b.x + pos.x, b.y + pos.y)
    await expect(page.getByRole('button', { name: 'Style' })).toBeVisible()
    await page.getByRole('button', { name: 'Style' }).click()
    await page.getByRole('button', { name: /Playfair Display/ }).click()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const ed = (window as unknown as { __cardEditor: { canvas: { getActiveObject(): { fontFamily: string } } } }).__cardEditor
          return ed.canvas.getActiveObject().fontFamily
        }),
      )
      .toBe('Playfair Display')
  })

  test('two-finger pinch zooms the view', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    await createCard(page, recipeId)
    const zoom = () => page.evaluate(() => (window as unknown as { __cardEditor: { canvas: { getZoom(): number } } }).__cardEditor.canvas.getZoom())
    const before = await zoom()
    await page.evaluate(() => {
      const host = document.querySelector('[data-testid="canvas-host"]')!
      const r = host.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const touch = (id: number, x: number, y: number) => new Touch({ identifier: id, target: host, clientX: x, clientY: y })
      const fire = (type: string, d: number) => {
        const touches = [touch(1, cx - d, cy), touch(2, cx + d, cy)]
        host.dispatchEvent(new TouchEvent(type, { touches, targetTouches: touches, changedTouches: touches, bubbles: true, cancelable: true }))
      }
      fire('touchstart', 40)
      for (let d = 50; d <= 140; d += 10) fire('touchmove', d)
      host.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [], bubbles: true, cancelable: true }))
    })
    expect(await zoom()).toBeGreaterThan(before * 2)
  })
})
