/**
 * Fonts bundled for cards (OFL, shipped as woff2 and precached so cards look
 * identical offline and in exports). The CSS lives in features/editor/fonts.css.
 */
export type FontCategory = 'serif' | 'sans' | 'display' | 'script'

export interface FontDef {
  family: string
  label: string
  category: FontCategory
  /** Weights bundled; the UI offers Regular and Bold where both exist. */
  weights: number[]
  italic?: boolean
}

export const FONTS: FontDef[] = [
  { family: 'Fraunces', label: 'Fraunces', category: 'serif', weights: [400, 600], italic: true },
  { family: 'Playfair Display', label: 'Playfair Display', category: 'serif', weights: [400, 700], italic: true },
  { family: 'Lora', label: 'Lora', category: 'serif', weights: [400, 700], italic: true },
  { family: 'Inter Variable', label: 'Inter', category: 'sans', weights: [400, 700] },
  { family: 'Josefin Sans', label: 'Josefin Sans', category: 'sans', weights: [400, 700] },
  { family: 'Abril Fatface', label: 'Abril Fatface', category: 'display', weights: [400] },
  { family: 'Amatic SC', label: 'Amatic SC', category: 'display', weights: [400, 700] },
  { family: 'Caveat', label: 'Caveat', category: 'script', weights: [400, 700] },
  { family: 'Dancing Script', label: 'Dancing Script', category: 'script', weights: [400, 700] },
]

export const DEFAULT_FONT = 'Inter Variable'

export function getFont(family: string): FontDef {
  return FONTS.find((f) => f.family === family) ?? FONTS.find((f) => f.family === DEFAULT_FONT)!
}

/** The bundled weight used for "bold" in a family (e.g. 600 for Fraunces). */
export function boldWeight(family: string): number {
  const w = getFont(family).weights
  return w.length > 1 ? w[w.length - 1] : w[0]
}

export function isBold(weight: unknown): boolean {
  const n = weight === 'bold' ? 700 : Number(weight)
  return Number.isFinite(n) && n >= 600
}

/** CSS font shorthand for `document.fonts.load`. */
export function fontSpec(family: string, weight: string | number = 400, style = 'normal'): string {
  return `${style === 'italic' ? 'italic ' : ''}${weight} 32px "${family}"`
}
