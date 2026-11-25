/**
 * SVG import (BLUEPRINT §6): DOMPurify strips scripts, foreignObject, event
 * handlers and external references; the root then gets a viewBox and a large
 * enough intrinsic size so it stays sharp when drawn on the card.
 */
import DOMPurify from 'dompurify'

export interface CleanSvg {
  text: string
  width: number
  height: number
}

/** SVGs are given at least this size on the long side so the canvas draws them crisply. */
const MIN_SIDE = 1024
const MAX_SIDE = 4096

const LOCAL_REF = /^\s*(#|data:image\/(png|jpe?g|gif|webp);)/i

function parseLength(v: string | null): number | undefined {
  if (!v) return undefined
  const m = /^\s*([\d.]+)\s*(px)?\s*$/.exec(v)
  const n = m ? parseFloat(m[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function sanitizeSvg(source: string): CleanSvg {
  const purify = DOMPurify()
  purify.addHook('uponSanitizeAttribute', (_node, data) => {
    const name = data.attrName.toLowerCase()
    if ((name === 'href' || name === 'xlink:href') && !LOCAL_REF.test(data.attrValue)) data.keepAttr = false
    // url(...) references outside the document (fonts, images) can't load inside <img> anyway.
    if (name === 'style' && /url\(\s*['"]?\s*(?!#)/i.test(data.attrValue)) data.keepAttr = false
  })
  const clean = purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // <use> is safe here because the hook above keeps only in-document references.
    ADD_TAGS: ['use'],
    FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'object', 'embed', 'audio', 'video'],
    WHOLE_DOCUMENT: false,
  })
  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('This SVG could not be read.')
  }

  const vb = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  const hasViewBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0
  let w = parseLength(root.getAttribute('width'))
  let h = parseLength(root.getAttribute('height'))
  if (hasViewBox) {
    if (!w && !h) [w, h] = [vb[2], vb[3]]
    else if (!w) w = (h! * vb[2]) / vb[3]
    else if (!h) h = (w * vb[3]) / vb[2]
  } else {
    w ??= 512
    h ??= 512
    root.setAttribute('viewBox', `0 0 ${w} ${h}`)
  }
  const long = Math.max(w!, h!)
  const k = long < MIN_SIDE ? MIN_SIDE / long : long > MAX_SIDE ? MAX_SIDE / long : 1
  const width = Math.round(w! * k)
  const height = Math.round(h! * k)
  root.setAttribute('width', String(width))
  root.setAttribute('height', String(height))
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return { text: new XMLSerializer().serializeToString(root), width, height }
}

/** Draw an SVG blob to a small PNG thumbnail (main thread; needs an <img>). */
export async function svgThumb(blob: Blob, width: number, height: number, side = 512): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const k = Math.min(1, side / Math.max(width, height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(width * k))
    c.height = Math.max(1, Math.round(height * k))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
    c.width = c.height = 0
    if (!out) throw new Error('Could not draw this SVG.')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
