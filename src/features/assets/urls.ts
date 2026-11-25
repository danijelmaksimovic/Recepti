/**
 * Session cache of object URLs and decoded images for stored assets. Designs
 * hold asset ids only; these are resolved here when a card is shown.
 */
import { getAsset } from '@/db'
import type { Asset, Id } from '@/domain/types'

const full = new Map<Id, Promise<string | undefined>>()
const thumbs = new Map<Id, string>()
const decoded = new Map<Id, HTMLImageElement>()
const decoding = new Map<Id, Promise<HTMLImageElement | undefined>>()

/** Object URL of the stored original, or undefined if the asset is gone. */
export function assetUrl(id: Id): Promise<string | undefined> {
  let p = full.get(id)
  if (!p) {
    p = getAsset(id).then((a) => {
      if (!a) {
        full.delete(id)
        return undefined
      }
      return URL.createObjectURL(a.blob)
    })
    full.set(id, p)
  }
  return p
}

/** Small preview URL for grids (thumb if there is one, else the original). */
export function thumbUrl(asset: Pick<Asset, 'id' | 'thumb' | 'blob' | 'updatedAt'>): string {
  const key = `${asset.id}:${asset.updatedAt}`
  let url = thumbs.get(key)
  if (!url) {
    url = URL.createObjectURL(asset.thumb ?? asset.blob)
    thumbs.set(key, url)
  }
  return url
}

/** A decoded image for painting (card backgrounds). */
export function loadAssetImage(id: Id): Promise<HTMLImageElement | undefined> {
  const hit = decoded.get(id)
  if (hit) return Promise.resolve(hit)
  let p = decoding.get(id)
  if (!p) {
    p = assetUrl(id).then(async (url) => {
      if (!url) return undefined
      const img = new Image()
      img.src = url
      try {
        await img.decode()
      } catch {
        return undefined
      } finally {
        decoding.delete(id)
      }
      decoded.set(id, img)
      return img
    })
    decoding.set(id, p)
  }
  return p
}

export function decodedAssetImage(id: Id): HTMLImageElement | undefined {
  return decoded.get(id)
}

/** Drop cached URLs after an asset is deleted. */
export function forgetAsset(id: Id) {
  void full.get(id)?.then((u) => u && URL.revokeObjectURL(u))
  full.delete(id)
  decoded.delete(id)
  for (const [k, u] of thumbs) {
    if (k.startsWith(`${id}:`)) {
      URL.revokeObjectURL(u)
      thumbs.delete(k)
    }
  }
}

/** Placeholder for a frame whose photo is missing (deleted asset or a recipe without a photo). */
export function placeholderUrl(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#e6dccd"/><g fill="none" stroke="#9c8a76" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" transform="translate(480 300) scale(10)"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9ZM3 15l5-4.5 4 3.5 3-2.5 6 5" stroke-width="1.4"/></g><text x="600" y="640" text-anchor="middle" font-family="system-ui, sans-serif" font-size="64" fill="#7a6a58">${label.replace(/[<&>]/g, '')}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
