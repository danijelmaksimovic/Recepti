/**
 * Offscreen rendering straight from the stored design document (not a
 * screenshot of the editor). Used for thumbnails now and exports later
 * (BLUEPRINT §7).
 */
import { StaticCanvas, util, type FabricObject } from 'fabric'
import { fontsInDoc, migrateDoc } from '@/domain/card/doc'
import type { TokenContext } from '@/domain/card/tokens'
import { paintPage, type PageSpec } from './background'
import { setupFabric } from './setup'
import { applyTextAll, ensureFonts } from './text'

class CardStaticCanvas extends StaticCanvas {
  page?: PageSpec
  _renderBackground(ctx: CanvasRenderingContext2D) {
    if (this.page) paintPage(ctx, this.viewportTransform, this.page)
  }
}

export interface RenderOptions {
  /** Output width in px; height follows the card's aspect ratio. */
  width: number
}

export async function renderDoc(
  rawDoc: unknown,
  card: { width: number; height: number },
  ctx: TokenContext | undefined,
  { width }: RenderOptions,
): Promise<HTMLCanvasElement> {
  setupFabric()
  const doc = migrateDoc(rawDoc)
  await ensureFonts(fontsInDoc(doc))
  const scale = width / card.width
  const el = document.createElement('canvas')
  const sc = new CardStaticCanvas(el, {
    width: Math.round(card.width * scale),
    height: Math.round(card.height * scale),
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  })
  try {
    sc.page = { width: card.width, height: card.height, background: doc.background }
    const objects = (await util.enlivenObjects(doc.objects)) as FabricObject[]
    applyTextAll(objects, ctx)
    sc.add(...objects)
    sc.setZoom(scale)
    sc.renderAll()
    const out = document.createElement('canvas')
    out.width = el.width
    out.height = el.height
    out.getContext('2d')!.drawImage(el, 0, 0)
    return out
  } finally {
    void sc.dispose()
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality))
}

export const THUMB_WIDTH = 480

export async function renderThumb(doc: unknown, card: { width: number; height: number }, ctx: TokenContext | undefined): Promise<Blob> {
  const c = await renderDoc(doc, card, ctx, { width: THUMB_WIDTH })
  const blob = await canvasToBlob(c)
  c.width = c.height = 0 // release memory early (iOS canvas limits)
  return blob
}
