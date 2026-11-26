import { expect, test, type Page } from '@playwright/test'
import { canvasTexts, createCard, deselect, seedRecipe, selectText, storedDesign, waitSaved } from './helpers'

type Obj = { text?: string; visible?: boolean; locked?: boolean; evented?: boolean; uid?: string; assetId?: string; type: string; left: number; top: number; getBoundingRect(): { left: number; top: number; width: number; height: number }; getCenterPoint(): { x: number; y: number } }
type Ed = {
  canvas: { getObjects(): Obj[]; getActiveObjects(): Obj[]; viewportTransform: number[] }
  page: { width: number; height: number }
}
const ed = (page: Page) => page.evaluateHandle(() => (window as unknown as { __cardEditor: Ed }).__cardEditor)

async function addHeading(page: Page) {
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByRole('button', { name: 'Add a heading' }).click()
}

async function openLayers(page: Page) {
  const btn = page.getByRole('button', { name: 'Show layers' })
  if (await btn.isVisible()) await btn.click()
  await expect(page.getByTestId('layer-row').first()).toBeVisible()
}

test.describe('Phase 7: undo, layers, arranging', () => {
  test('undo and redo step through changes, and the result is saved', async ({ page, isMobile }) => {
    const recipeId = await seedRecipe(page)
    const id = await createCard(page, recipeId, { blank: true })
    await addHeading(page)
    await expect.poll(() => canvasTexts(page)).toEqual(['Your heading'])
    await deselect(page)
    if (isMobile) await page.getByRole('button', { name: 'Close panel' }).click({ timeout: 1500 }).catch(() => {})
    const undo = page.getByRole('button', { name: 'Undo' })
    await expect(undo).toBeEnabled()
    await undo.click()
    await expect.poll(() => canvasTexts(page)).toEqual([])
    await page.getByRole('button', { name: 'Redo' }).click()
    await expect.poll(() => canvasTexts(page)).toEqual(['Your heading'])

    // Background change is one more step; keyboard shortcuts work on desktop.
    if (!isMobile) {
      await page.keyboard.press('Control+z')
      await expect.poll(() => canvasTexts(page)).toEqual([])
      await page.keyboard.press('Control+Shift+z')
      await expect.poll(() => canvasTexts(page)).toEqual(['Your heading'])
    }
    await waitSaved(page)
    const d = await storedDesign(page, id)
    expect(JSON.stringify(d!.canvas)).toContain('Your heading')
  })

  test('layers list, hide, lock and restack', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    const id = await createCard(page, recipeId, { blank: true })
    await addHeading(page)
    await deselect(page)
    await page.getByRole('button', { name: 'Fields' }).click()
    await page.getByRole('button', { name: /^Servings/ }).click()
    await deselect(page)
    await openLayers(page)

    // Top-most first.
    const rows = page.getByTestId('layer-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Servings')
    await expect(rows.nth(1)).toContainText('Your heading')

    // Restack with the keyboard on the grip.
    await page.getByRole('button', { name: 'Move Servings' }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(rows.nth(0)).toContainText('Your heading')
    expect(await canvasTexts(page)).toEqual(['8', 'Your heading'])

    // Hide.
    await page.getByRole('button', { name: 'Hide Your heading' }).click()
    const h = await ed(page)
    expect(await h.evaluate((e) => e.canvas.getObjects().find((o) => o.text === 'Your heading')!.visible)).toBe(false)

    // Lock: can't be picked on the card or deleted.
    await page.getByRole('button', { name: 'Lock Servings' }).click()
    expect(await h.evaluate((e) => e.canvas.getObjects().find((o) => o.text === '8')!.evented)).toBe(false)
    await rows.filter({ hasText: 'Servings' }).getByRole('button', { name: 'Servings', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Unlock' }).filter({ visible: true }).first()).toBeVisible()
    await page.keyboard.press('Delete')
    expect(await canvasTexts(page)).toContain('8')

    await waitSaved(page)
    const objects = ((await storedDesign(page, id))!.canvas as { objects: Obj[] }).objects
    expect(objects.find((o) => o.text === 'Your heading')!.visible).toBe(false)
    expect(objects.find((o) => o.text?.includes('servings'))!.locked).toBe(true)
    expect(objects.every((o) => typeof o.uid === 'string' && o.uid.length > 4)).toBe(true)
  })

  test('align to the card, order buttons and multi-select align', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    await createCard(page, recipeId, { blank: true })
    await addHeading(page)
    await deselect(page)
    await page.getByRole('button', { name: 'Text', exact: true }).click().catch(() => {})
    if (!(await page.getByRole('button', { name: 'Add a line of text' }).isVisible())) await page.getByRole('button', { name: 'Text', exact: true }).click()
    await page.getByRole('button', { name: 'Add a line of text' }).click()

    // Single object: align left edge to the card.
    await selectText(page, 'Write something')
    const arrange = page.getByRole('button', { name: 'Arrange' })
    if (await arrange.isVisible()) await arrange.click()
    await page.getByRole('button', { name: 'Align left' }).click()
    const h = await ed(page)
    await expect.poll(() => h.evaluate((e) => Math.round(e.canvas.getObjects().find((o) => o.text?.includes('Write'))!.getBoundingRect().left))).toBe(0)

    // Send to back puts it under the heading.
    await page.getByRole('button', { name: 'Send to back' }).click()
    await expect.poll(() => canvasTexts(page)).toEqual(['Write something here', 'Your heading'])

    // Select both from the layers panel and align their tops.
    await deselect(page)
    await page.getByRole('button', { name: 'Close panel' }).click({ timeout: 1500 }).catch(() => {})
    await openLayers(page)
    await page.getByRole('button', { name: 'Select several' }).click()
    await page.getByTestId('layer-row').nth(0).getByRole('button').nth(1).click()
    await page.getByTestId('layer-row').nth(1).getByRole('button').nth(1).click()
    await expect.poll(() => h.evaluate((e) => e.canvas.getActiveObjects().length)).toBe(2)
    const arr = page.getByRole('button', { name: 'Arrange' })
    if (await arr.isVisible()) await arr.click()
    await page.getByRole('button', { name: 'Align top' }).click()
    await expect
      .poll(() =>
        h.evaluate((e) => {
          const [a, b] = e.canvas.getObjects().map((o) => o.getBoundingRect().top)
          return Math.abs(a - b) < 0.5
        }),
      )
      .toBe(true)
  })
})

test.describe('Phase 7: smart guides', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse drag')

  test('dragging near the card centre snaps to it', async ({ page }) => {
    const recipeId = await seedRecipe(page)
    await createCard(page, recipeId, { blank: true })
    await addHeading(page)
    const h = await ed(page)
    const host = (await page.getByTestId('canvas-host').boundingBox())!
    const info = await h.evaluate((e) => {
      const o = e.canvas.getObjects()[0]
      const c = o.getCenterPoint()
      const v = e.canvas.viewportTransform
      return { x: c.x * v[0] + v[4], y: c.y * v[3] + v[5], z: v[0], W: e.page.width }
    })
    const sx = host.x + info.x
    const sy = host.y + info.y
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    // Away, then back to 3 screen px right of the centre line.
    await page.mouse.move(sx + 60, sy + 40, { steps: 5 })
    await page.mouse.move(sx + 3, sy + 40, { steps: 5 })
    await page.mouse.up()
    const cx = await h.evaluate((e) => e.canvas.getObjects()[0].getCenterPoint().x)
    expect(cx).toBeCloseTo(info.W / 2, 1)
  })
})

/** Draw a stroke on the sketch pad with synthetic pointer events (pen keeps its pressure). */
async function stroke(page: Page, pts: [number, number][], type: 'pen' | 'touch' | 'mouse', id = 7) {
  await page.evaluate(
    ({ pts, type, id }) => {
      const el = document.querySelector('[data-testid="sketch-canvas"]')!
      const r = el.getBoundingClientRect()
      const fire = (kind: string, [fx, fy]: [number, number], i: number) =>
        el.dispatchEvent(
          new PointerEvent(kind, {
            pointerId: id,
            pointerType: type,
            isPrimary: true,
            pressure: kind === 'pointerup' ? 0 : 0.3 + 0.6 * Math.sin((i / pts.length) * Math.PI),
            clientX: r.left + fx * r.width,
            clientY: r.top + fy * r.height,
            buttons: kind === 'pointerup' ? 0 : 1,
            button: kind === 'pointermove' ? -1 : 0,
            width: type === 'touch' ? 20 : 1,
            height: type === 'touch' ? 20 : 1,
            bubbles: true,
            cancelable: true,
          }),
        )
      fire('pointerdown', pts[0], 0)
      pts.slice(1).forEach((p, i) => fire('pointermove', p, i + 1))
      fire('pointerup', pts[pts.length - 1], pts.length)
    },
    { pts, type, id },
  )
}

const pad = (page: Page) => page.getByRole('dialog', { name: /^(Draw|Edit drawing)$/ })

const wave = (y: number, x0 = 0.3, x1 = 0.7): [number, number][] => Array.from({ length: 24 }, (_, i) => [x0 + ((x1 - x0) * i) / 23, y + 0.03 * Math.sin(i / 3)])

test.describe('Phase 7: sketch pad', () => {
  test('pen drawing becomes an editable, transparent drawing on the card', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => localStorage.removeItem('sketch.prefs'))
    const recipeId = await seedRecipe(page)
    const id = await createCard(page, recipeId, { blank: true })
    await page.getByRole('button', { name: 'Draw' }).click()
    await expect(page.getByTestId('sketch-canvas')).toBeVisible()
    await expect(page.getByTestId('sketch-canvas')).toBeVisible()
    await expect(pad(page).getByRole('button', { name: 'Done' })).toBeDisabled()

    // Pen stroke, then a "palm" touch: fingers stop drawing once a pen was used.
    await stroke(page, wave(0.4), 'pen')
    await expect(page.getByRole('status').filter({ hasText: 'Pen found' })).toBeVisible()
    await stroke(page, wave(0.7), 'touch', 9)
    await pad(page).getByRole('button', { name: 'Undo' }).click()
    await pad(page).getByRole('button', { name: 'Redo' }).click()
    await pad(page).getByRole('button', { name: 'Done' }).click()
    await expect(page.getByTestId('sketch-canvas')).toHaveCount(0)

    // Placed on the card where it was drawn (middle band of the card).
    const h = await ed(page)
    const placed = await h.evaluate((e) => {
      const o = e.canvas.getObjects()[0]
      const c = o.getCenterPoint()
      return { type: o.type, assetId: o.assetId, cx: c.x / e.page.width, cy: c.y / e.page.height }
    })
    expect(placed.type).toBe('image')
    expect(placed.cx).toBeGreaterThan(0.4)
    expect(placed.cx).toBeLessThan(0.6)
    expect(placed.cy).toBeGreaterThan(0.33)
    expect(placed.cy).toBeLessThan(0.47)

    const asset = await page.evaluate(async (assetId) => {
      const db = await import('/src/db/index.ts')
      const a = (await db.getAsset(assetId!))!
      const bmp = await createImageBitmap(a.blob)
      const c = new OffscreenCanvas(bmp.width, bmp.height)
      const g = c.getContext('2d')!
      g.drawImage(bmp, 0, 0)
      const corner = g.getImageData(0, 0, 1, 1).data[3]
      const sd = a.sketchData as { strokes: { pressure: boolean }[] }
      return { kind: a.kind, mime: a.mime, corner, strokes: sd.strokes.length, pressure: sd.strokes[0].pressure }
    }, placed.assetId)
    expect(asset).toEqual({ kind: 'drawing', mime: 'image/png', corner: 0, strokes: 1, pressure: true })

    // Re-edit: the strokes come back, one more is added, the card shows the new version.
    const editBtn = page.getByRole('button', { name: 'Edit drawing' })
    if (!(await editBtn.isVisible())) await page.getByRole('button', { name: 'Crop' }).click()
    await editBtn.click()
    await expect(page.getByTestId('sketch-canvas')).toBeVisible()
    await expect(pad(page).getByRole('button', { name: 'Undo' })).toBeDisabled()
    await pad(page).getByRole('radio', { name: 'Marker' }).click()
    await stroke(page, wave(0.6, 0.35, 0.65), 'mouse')
    await pad(page).getByRole('button', { name: 'Done' }).click()
    await expect(page.getByTestId('sketch-canvas')).toHaveCount(0)
    const after = await h.evaluate((e) => ({ n: e.canvas.getObjects().length, assetId: e.canvas.getObjects()[0].assetId }))
    expect(after.n).toBe(1)
    expect(after.assetId).not.toBe(placed.assetId)
    const strokes = await page.evaluate(async (assetId) => {
      const db = await import('/src/db/index.ts')
      return ((await db.getAsset(assetId!))!.sketchData as { strokes: { tool: string }[] }).strokes.map((s) => s.tool)
    }, after.assetId)
    expect(strokes).toEqual(['pen', 'marker'])

    await waitSaved(page)
    expect(JSON.stringify((await storedDesign(page, id))!.canvas)).toContain(after.assetId!)
    expect(errors).toEqual([])
  })

  test('fingers draw when no pen is used, and two fingers do not leave a mark', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('sketch.prefs'))
    const recipeId = await seedRecipe(page)
    await createCard(page, recipeId, { blank: true })
    await page.getByRole('button', { name: 'Draw' }).click()
    await expect(page.getByTestId('sketch-canvas')).toBeVisible()
    await stroke(page, wave(0.5), 'touch')
    await expect(pad(page).getByRole('button', { name: 'Done' })).toBeEnabled()
    await pad(page).getByRole('button', { name: 'Clear' }).click()
    await expect(pad(page).getByRole('button', { name: 'Done' })).toBeDisabled()

    // Second finger lands right after the first: it's a pinch, not a stroke.
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="sketch-canvas"]')!
      const r = el.getBoundingClientRect()
      const ev = (kind: string, id: number, x: number, y: number) =>
        el.dispatchEvent(new PointerEvent(kind, { pointerId: id, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, buttons: kind === 'pointerup' ? 0 : 1, width: 20, height: 20, bubbles: true, cancelable: true }))
      ev('pointerdown', 1, 100, 200)
      ev('pointermove', 1, 104, 204)
      ev('pointerdown', 2, 200, 200)
      for (let i = 1; i < 10; i++) {
        ev('pointermove', 1, 100 - i * 4, 200)
        ev('pointermove', 2, 200 + i * 4, 200)
      }
      ev('pointerup', 1, 60, 200)
      ev('pointerup', 2, 240, 200)
    })
    await expect(pad(page).getByRole('button', { name: 'Done' })).toBeDisabled()
    await pad(page).getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByTestId('sketch-canvas')).toHaveCount(0)
  })
})
