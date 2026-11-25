import { createDesign, getCategory } from '@/db'
import { emptyDoc } from '@/domain/card/doc'
import { starterLayout } from '@/domain/card/layout'
import type { CanvasJSON, Design, Recipe } from '@/domain/types'
import { renderThumb } from './fabric/render'

export type StartWith = 'layout' | 'blank'

/** Create a design for a recipe, with the starter field layout or an empty card. */
export async function createCard(recipe: Recipe, opts: { presetId: string; name: string; width: number; height: number; startWith: StartWith }): Promise<Design> {
  const doc = emptyDoc()
  if (opts.startWith === 'layout') doc.objects = starterLayout(opts.width, opts.height)
  let thumb: Blob | undefined
  try {
    const category = recipe.categoryId ? await getCategory(recipe.categoryId) : undefined
    thumb = await renderThumb(doc, opts, { recipe, categoryName: category?.name })
  } catch (e) {
    console.warn('Thumbnail failed', e)
  }
  return createDesign({ recipeId: recipe.id, name: opts.name, preset: opts.presetId, width: opts.width, height: opts.height, canvas: doc as unknown as CanvasJSON, thumb })
}
