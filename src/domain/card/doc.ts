/**
 * The design document stored in `Design.canvas` / `Template.canvas`.
 *
 * It wraps Fabric's object JSON with our own versioned envelope, so the card
 * format is ours (and migratable) rather than whatever a Fabric release emits.
 * Text objects carry `sourceText` (with tokens); their resolved `text` is never
 * relied on and is replaced with `sourceText` when saving (BLUEPRINT §4).
 */

export const CARD_DOC_VERSION = 1

/** Extra object properties that are always serialized (BLUEPRINT §5). */
export const CUSTOM_PROPS = ['name', 'sourceText', 'listStyle', 'baseFontSize', 'maxHeight', 'binding', 'assetId', 'locked'] as const

export type TextureKind = 'none' | 'dots' | 'grid' | 'lines' | 'diagonal' | 'gingham' | 'paper' | 'linen'

export const TEXTURES: { kind: TextureKind; label: string }[] = [
  { kind: 'none', label: 'None' },
  { kind: 'paper', label: 'Paper' },
  { kind: 'linen', label: 'Linen' },
  { kind: 'dots', label: 'Dots' },
  { kind: 'grid', label: 'Grid' },
  { kind: 'lines', label: 'Ruled' },
  { kind: 'diagonal', label: 'Stripes' },
  { kind: 'gingham', label: 'Gingham' },
]

export interface CardBackground {
  color: string
  texture: TextureKind
  textureColor: string
  /** 0–1 */
  textureOpacity: number
  /** Pattern scale, 0.5–3. */
  textureScale: number
}

export type CardObjectJSON = Record<string, unknown> & { type: string }

export interface CardDoc {
  version: typeof CARD_DOC_VERSION
  background: CardBackground
  objects: CardObjectJSON[]
}

export const DEFAULT_BACKGROUND: CardBackground = {
  color: '#fffaf2',
  texture: 'none',
  textureColor: '#8a6a4a',
  textureOpacity: 0.25,
  textureScale: 1,
}

export function emptyDoc(background: Partial<CardBackground> = {}): CardDoc {
  return { version: CARD_DOC_VERSION, background: { ...DEFAULT_BACKGROUND, ...background }, objects: [] }
}

const HEX = /^#[0-9a-f]{6}$/i
const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback

function cleanBackground(raw: unknown): CardBackground {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<CardBackground>
  return {
    color: typeof b.color === 'string' && HEX.test(b.color) ? b.color : DEFAULT_BACKGROUND.color,
    texture: TEXTURES.some((t) => t.kind === b.texture) ? (b.texture as TextureKind) : 'none',
    textureColor: typeof b.textureColor === 'string' && HEX.test(b.textureColor) ? b.textureColor : DEFAULT_BACKGROUND.textureColor,
    textureOpacity: clamp(b.textureOpacity, 0, 1, DEFAULT_BACKGROUND.textureOpacity),
    textureScale: clamp(b.textureScale, 0.5, 3, 1),
  }
}

/** Migrators keyed by the version they upgrade *from*. */
const MIGRATORS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {
  // Version 0: anything saved before the envelope existed (e.g. raw Fabric JSON
  // or an empty object). Keep its objects; the background starts at defaults.
  0: (doc) => ({ ...doc, version: 1 }),
}

/**
 * Bring any stored canvas JSON up to the current version and fill gaps, so the
 * editor and renderer can trust the shape. Never throws on odd input.
 */
export function migrateDoc(raw: unknown): CardDoc {
  let doc = (raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}) as Record<string, unknown>
  let v = typeof doc.version === 'number' && Number.isInteger(doc.version) ? doc.version : 0
  while (v < CARD_DOC_VERSION) {
    const step = MIGRATORS[v]
    doc = step ? step(doc) : { ...doc, version: v + 1 }
    v = doc.version as number
  }
  if (v > CARD_DOC_VERSION) {
    // Written by a newer app version; keep what we understand.
    console.warn(`Card format ${v} is newer than this app (${CARD_DOC_VERSION}).`)
  }
  const objects = Array.isArray(doc.objects)
    ? (doc.objects.filter((o) => o && typeof o === 'object' && typeof (o as { type?: unknown }).type === 'string') as CardObjectJSON[])
    : []
  return { version: CARD_DOC_VERSION, background: cleanBackground(doc.background), objects }
}

/**
 * Prepare serialized objects for storage: tokenized text is stored as its
 * source, never as the resolved recipe content, and per-character styles
 * (which would point at resolved characters) are dropped.
 */
export function stripResolvedText(objects: CardObjectJSON[]): CardObjectJSON[] {
  return objects.map((o) => {
    if (typeof o.sourceText !== 'string') return o
    const { styles: _styles, ...rest } = o
    return { ...rest, text: o.sourceText }
  })
}

/** Every font family a document uses, with the weights it needs. */
export function fontsInDoc(doc: Pick<CardDoc, 'objects'>): { family: string; weight: string; style: string }[] {
  const seen = new Map<string, { family: string; weight: string; style: string }>()
  const walk = (objs: unknown[]) => {
    for (const o of objs as Record<string, unknown>[]) {
      if (typeof o.fontFamily === 'string') {
        const weight = String(o.fontWeight ?? 'normal')
        const style = String(o.fontStyle ?? 'normal')
        seen.set(`${o.fontFamily}|${weight}|${style}`, { family: o.fontFamily, weight, style })
      }
      if (Array.isArray(o.objects)) walk(o.objects)
    }
  }
  walk(doc.objects)
  return [...seen.values()]
}
