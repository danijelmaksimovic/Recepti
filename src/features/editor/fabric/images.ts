/**
 * Images on the card. Stored JSON carries only `assetId` (or a `binding` to a
 * recipe photo) plus a size-independent crop and corner radius; the actual
 * pixels are resolved to object URLs when a card is loaded or rendered.
 */
import { FabricImage, Rect, util, type FabricObject } from 'fabric'
import type { CardObjectJSON } from '@/domain/card/doc'
import { DEFAULT_CROP, cleanCrop, cropRect, type CropSpec } from '@/domain/card/crop'
import type { TokenContext } from '@/domain/card/tokens'
import { assetUrl, placeholderUrl } from '@/features/assets/urls'

export interface CardImageProps {
  assetId?: string
  /** `recipe.photo` or `recipe.photos[n]`: shows the recipe's photo instead of a fixed asset. */
  binding?: string
  crop?: CropSpec
  /** Corner radius as a fraction of the frame's short side (0.5 = round). */
  radius?: number
  name?: string
  /** Asset currently shown by a bound frame (never serialized). */
  shownAssetId?: string
}

export type CardImage = FabricImage & CardImageProps

export function isCardImage(o: unknown): o is CardImage {
  return o instanceof FabricImage
}

export const RECIPE_PHOTO = 'recipe.photo'

/** Asset a binding points to for this recipe. */
export function boundAssetId(binding: string, ctx: TokenContext | undefined): string | undefined {
  const r = ctx?.recipe
  if (!r) return undefined
  if (binding === RECIPE_PHOTO) return r.photoAssetId ?? r.photoAssetIds[0]
  const m = /^recipe\.photos\[(\d+)\]$/.exec(binding)
  return m ? r.photoAssetIds[Number(m[1])] : undefined
}

function targetAsset(o: { assetId?: unknown; binding?: unknown }, ctx: TokenContext | undefined): string | undefined {
  if (typeof o.binding === 'string' && o.binding) return boundAssetId(o.binding, ctx)
  return typeof o.assetId === 'string' ? o.assetId : undefined
}

async function sourceFor(id: string | undefined, bound: boolean): Promise<string> {
  const url = id ? await assetUrl(id) : undefined
  return url ?? placeholderUrl(bound ? 'Recipe photo' : 'Image missing')
}

/** Give every image object a loadable `src`, recursing into groups. */
async function prepare(o: CardObjectJSON, ctx: TokenContext | undefined): Promise<CardObjectJSON> {
  if (o.type === 'Image') {
    const id = targetAsset(o as { assetId?: unknown; binding?: unknown }, ctx)
    return { ...o, src: await sourceFor(id, !!o.binding), crossOrigin: null, shownAssetId: id }
  }
  if (Array.isArray(o.objects)) return { ...o, objects: await Promise.all((o.objects as CardObjectJSON[]).map((c) => prepare(c, ctx))) }
  return o
}

/** Show the crop spec, keeping the frame's centre and (optionally) its visible area. */
export function applyCrop(img: CardImage, spec: CropSpec, keepArea = true) {
  const nat = img.getOriginalSize()
  if (!nat.width || !nat.height) return
  const r = cropRect(nat.width, nat.height, spec)
  const centre = img.getCenterPoint()
  const area = img.getScaledWidth() * img.getScaledHeight()
  img.set({ cropX: r.x, cropY: r.y, width: r.width, height: r.height })
  if (keepArea && area > 0) {
    const s = Math.sqrt(area / (r.width * r.height))
    img.set({ scaleX: s * Math.sign(img.scaleX || 1), scaleY: s * Math.sign(img.scaleY || 1) })
  }
  img.setPositionByOrigin(centre, 'center', 'center')
  img.crop = cleanCrop(spec)
  applyRadius(img)
  img.setCoords()
}

export function applyRadius(img: CardImage) {
  const r = Math.min(0.5, Math.max(0, img.radius ?? 0)) * Math.min(img.width, img.height)
  img.clipPath = r > 0.5 ? new Rect({ width: img.width, height: img.height, rx: r, ry: r, originX: 'center', originY: 'center', left: 0, top: 0 }) : undefined
  img.dirty = true
}

/** Images keep their proportions: corner handles only. */
export function setupImage(img: CardImage) {
  img.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false })
  img.crop = cleanCrop(img.crop ?? DEFAULT_CROP)
  applyCrop(img, img.crop)
}

/** Enliven stored objects with their images resolved. */
export async function enlivenCardObjects(objects: CardObjectJSON[], ctx: TokenContext | undefined): Promise<FabricObject[]> {
  const prepared = await Promise.all(objects.map((o) => prepare(o, ctx)))
  const live = (await util.enlivenObjects(prepared)) as FabricObject[]
  const walk = (list: FabricObject[]) => {
    for (const o of list) {
      if (isCardImage(o)) setupImage(o)
      const children = (o as unknown as { _objects?: FabricObject[] })._objects
      if (children) walk(children)
    }
  }
  walk(live)
  return live
}

/** Re-point bound frames after the recipe's photos changed. Returns true if any changed. */
export async function refreshBoundImages(objects: FabricObject[], ctx: TokenContext | undefined): Promise<boolean> {
  let changed = false
  for (const o of objects) {
    if (!isCardImage(o) || !o.binding) continue
    const id = boundAssetId(o.binding, ctx)
    if (id === o.shownAssetId) continue
    o.shownAssetId = id
    await o.setSrc(await sourceFor(id, true))
    applyCrop(o, o.crop ?? DEFAULT_CROP)
    changed = true
  }
  return changed
}
