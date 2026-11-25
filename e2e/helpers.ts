import { expect, type Page } from '@playwright/test'

/** Seed a recipe through the app's own storage layer (dev server only). */
export async function seedRecipe(page: Page, overrides: Record<string, unknown> = {}): Promise<string> {
  await page.goto('/')
  return page.evaluate(async (o) => {
    const db = await import('/src/db/index.ts')
    const cats = await db.listCategories()
    const r = await db.createRecipe({
      name: 'Plum cake with walnuts',
      description: 'A soft, buttery Sunday bake.',
      categoryId: cats[0]?.id,
      prepMin: 25,
      cookMin: 50,
      servings: 8,
      difficulty: 'easy',
      ingredients: [
        { qty: 200, unit: 'g', name: 'flour' },
        { qty: 3, unit: '', name: 'eggs' },
        { qty: 600, unit: 'g', name: 'plums', note: 'halved' },
      ],
      steps: [{ text: 'Cream butter and sugar.' }, { text: 'Bake for 50 minutes.' }],
      tags: [],
      notes: '',
      ...o,
    })
    return r.id
  }, overrides)
}

export async function createCard(page: Page, recipeId: string, opts: { preset?: RegExp; landscape?: boolean; blank?: boolean } = {}) {
  await page.goto(`/recipes/${recipeId}`)
  await page.getByRole('button', { name: 'New card' }).click()
  if (opts.preset) await page.getByRole('button', { name: opts.preset }).click()
  if (opts.landscape) await page.getByRole('radio', { name: 'Landscape' }).click()
  if (opts.blank) await page.getByRole('radio', { name: 'Blank card' }).click()
  await page.getByRole('button', { name: 'Create and open' }).click()
  await page.waitForURL(/\/studio\/cards\//)
  await waitForEditor(page)
  return page.url().split('/').pop()!
}

export async function waitForEditor(page: Page) {
  await page.waitForFunction(() => !!(window as unknown as { __cardEditor?: unknown }).__cardEditor)
  await expect(page.getByRole('status').filter({ hasText: /Saved/ })).toBeVisible()
}

/** Text shown by each canvas object, in stacking order. */
export function canvasTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as unknown as { __cardEditor: { canvas: { getObjects(): { text?: string }[] } } }).__cardEditor.canvas
      .getObjects()
      .map((o) => o.text ?? ''),
  )
}

export function storedDesign(page: Page, id: string) {
  return page.evaluate(async (designId) => {
    const db = await import('/src/db/index.ts')
    const d = await db.getDesign(designId)
    return d && { ...d, thumb: d.thumb ? d.thumb.size : 0 }
  }, id)
}

export async function waitSaved(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 8000 })
}

/** Select the object whose displayed text contains `text` (via the editor, like a tap would). */
export async function selectText(page: Page, text: string) {
  await page.evaluate((t) => {
    type O = { text?: string }
    const ed = (window as unknown as { __cardEditor: { canvas: { getObjects(): O[]; setActiveObject(o: O): void; requestRenderAll(): void }; emitSelection(): void } }).__cardEditor
    const o = ed.canvas.getObjects().find((x) => x.text?.includes(t))
    if (!o) throw new Error(`No text "${t}"`)
    ed.canvas.setActiveObject(o)
    ed.canvas.requestRenderAll()
    ed.emitSelection()
  }, text)
}

export function deselect(page: Page) {
  return page.evaluate(() => (window as unknown as { __cardEditor: { deselect(): void } }).__cardEditor.deselect())
}
