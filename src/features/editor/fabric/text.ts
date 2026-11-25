import { cache, type FabricObject } from 'fabric'
import { fontSpec } from '@/domain/card/fonts'
import { getField, resolveText, tokensIn, type TokenContext } from '@/domain/card/tokens'
import { isCardText, type CardText } from './setup'
// Anything that measures or draws card text needs the card fonts registered.
import '../fonts.css'

const loaded = new Map<string, Promise<unknown>>()

/** Wait until the given fonts can be measured (BLUEPRINT §5: always load before rendering text). */
export async function ensureFonts(fonts: { family: string; weight?: string | number; style?: string }[]) {
  if (typeof document === 'undefined' || !document.fonts) return
  const fresh: Promise<unknown>[] = []
  for (const f of fonts) {
    const weight = f.weight === 'bold' ? 700 : f.weight === 'normal' || f.weight === undefined ? 400 : f.weight
    const spec = fontSpec(f.family, weight, f.style)
    let p = loaded.get(spec)
    if (!p) {
      p = document.fonts.load(spec).then(
        (faces) => {
          // Not registered (yet): try again next time instead of caching a miss.
          if (!faces.length) loaded.delete(spec)
          return faces
        },
        () => loaded.delete(spec),
      )
      loaded.set(spec, p)
      fresh.push(p)
    }
    await p
  }
  if (fresh.length) cache.clearFontCache()
}

export interface ApplyTextOptions {
  /** Show "[Field]" for empty fields so they stay visible and selectable (editor only). */
  placeholders?: boolean
}

/**
 * Show the recipe's content in a text object and shrink it to its box if needed.
 * Only `text`/`fontSize` change; `sourceText` stays the source of truth.
 */
export function applyText(o: CardText, ctx: TokenContext | undefined, opts: ApplyTextOptions = {}) {
  if (o.sourceText === undefined) o.sourceText = o.text
  const source = o.sourceText
  let text = resolveText(source, ctx, { listStyle: o.listStyle })
  if (!text.trim() && opts.placeholders) {
    const keys = tokensIn(source)
    text = keys.length ? keys.map((k) => `[${getField(k)?.label ?? k}]`).join(' ') : '[Empty text]'
  }
  const base = o.baseFontSize ?? o.fontSize
  o.baseFontSize = base
  o.set({ text, fontSize: base })
  o.initDimensions()
  o.overflow = false
  if (o.maxHeight && o.maxHeight > 0) {
    let size = base
    const min = base * 0.5
    while (o.height > o.maxHeight && size > min) {
      size = Math.max(min, size * 0.94)
      o.set({ fontSize: size })
      o.initDimensions()
    }
    o.overflow = o.height > o.maxHeight + 0.5
  }
  o.setCoords()
}

export function applyTextAll(objects: FabricObject[], ctx: TokenContext | undefined, opts?: ApplyTextOptions) {
  for (const o of objects) if (isCardText(o)) applyText(o, ctx, opts)
}
