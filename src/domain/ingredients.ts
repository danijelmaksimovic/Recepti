import type { Ingredient } from './types'

/**
 * One-line ingredient entry (BLUEPRINT §10): "1 1/2 cups flour, sifted" becomes
 * { qty: 1.5, unit: 'cups', name: 'flour', note: 'sifted' }.
 * Anything the parser does not recognise stays in `name`, so nothing typed is lost.
 */

export type ParsedIngredient = Omit<Ingredient, 'id'>

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
}

/** Lower-case unit words the parser accepts after a quantity. Kept as typed. */
const UNITS = new Set([
  'g', 'gr', 'gram', 'grams', 'kg', 'kilo', 'kilos', 'mg',
  'ml', 'l', 'liter', 'liters', 'litre', 'litres', 'dl', 'cl',
  'tsp', 'tsps', 'teaspoon', 'teaspoons', 'tbsp', 'tbsps', 'tablespoon', 'tablespoons',
  'cup', 'cups', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'pint', 'pints', 'quart', 'quarts',
  'pinch', 'pinches', 'dash', 'dashes', 'clove', 'cloves', 'can', 'cans', 'tin', 'tins', 'jar', 'jars',
  'pack', 'packs', 'packet', 'packets', 'piece', 'pieces', 'pc', 'pcs', 'slice', 'slices',
  'bunch', 'bunches', 'handful', 'handfuls', 'sprig', 'sprigs', 'stick', 'sticks', 'drop', 'drops',
])

const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('')
// "1", "1.5", "1,5", "1/2", "1 1/2", "1½", "½"
const QTY = new RegExp(
  `^(\\d+(?:[.,]\\d+)?\\s+\\d+/\\d+|\\d+/\\d+|\\d*[${FRACTION_CHARS}]|\\d+(?:[.,]\\d+)?)(?=\\s|$|[a-zA-Z])`,
)

function parseQty(raw: string): number | undefined {
  const s = raw.trim().replace(',', '.')
  const mixed = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[2]) === 0 ? undefined : Number(frac[1]) / Number(frac[2])
  const uni = s.match(new RegExp(`^(\\d*)([${FRACTION_CHARS}])$`))
  if (uni) return Number(uni[1] || 0) + UNICODE_FRACTIONS[uni[2]]
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** Parse one line. Returns undefined for blank lines. */
export function parseIngredientLine(line: string): ParsedIngredient | undefined {
  let rest = line.trim().replace(/^[-•*]\s*/, '')
  if (!rest) return undefined

  let qty: number | undefined
  const m = rest.match(QTY)
  if (m) {
    qty = parseQty(m[1])
    if (qty !== undefined) rest = rest.slice(m[0].length).trim()
  }

  let unit = ''
  if (qty !== undefined) {
    const u = rest.match(/^([a-zA-Z]+)\.?(?:\s+|$)/)
    if (u && UNITS.has(u[1].toLowerCase())) {
      unit = u[1]
      rest = rest.slice(u[0].length).trim()
      if (rest.toLowerCase().startsWith('of ')) rest = rest.slice(3).trim()
    }
  }

  let note: string | undefined
  const comma = rest.indexOf(',')
  if (comma > 0) {
    note = rest.slice(comma + 1).trim() || undefined
    rest = rest.slice(0, comma).trim()
  }

  // "200 g" with no name: keep what was typed rather than drop the line.
  if (!rest) return { qty: undefined, unit: '', name: line.trim() }
  return { qty, unit, name: rest, ...(note ? { note } : {}) }
}

/** A line ending in ":" is a group heading, e.g. "For the sauce:". */
export function parseGroupHeading(line: string): string | undefined {
  const t = line.trim()
  return t.length > 1 && t.endsWith(':') ? t.slice(0, -1).trim() : undefined
}

/** Editor lines (ingredients and "Heading:" lines) to ingredients with `group` set. */
export function linesToIngredients<T extends { id?: string; text: string }>(lines: readonly T[]): (ParsedIngredient & { id?: string })[] {
  const out: (ParsedIngredient & { id?: string })[] = []
  let group: string | undefined
  for (const l of lines) {
    const heading = parseGroupHeading(l.text)
    if (heading !== undefined) {
      group = heading
      continue
    }
    const p = parseIngredientLine(l.text)
    if (p) out.push({ ...p, id: l.id, ...(group ? { group } : {}) })
  }
  return out
}

/** Ingredients back to editor lines, inserting a heading line where the group changes. */
export function ingredientsToLines(ings: readonly Ingredient[]): { id: string; text: string; heading?: boolean }[] {
  const out: { id: string; text: string; heading?: boolean }[] = []
  let group: string | undefined
  for (const i of ings) {
    if ((i.group ?? undefined) !== group) {
      group = i.group
      if (group) out.push({ id: `heading-${i.id}`, text: `${group}:`, heading: true })
    }
    out.push({ id: i.id, text: formatIngredient(i) })
  }
  return out
}

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
]

/** 1.5 → "1½", 0.333 → "⅓", 2.25 → "2¼", 1.37 → "1.37". */
export function formatQty(q: number): string {
  const whole = Math.floor(q)
  const frac = q - whole
  if (frac < 0.01) return String(whole)
  const nice = NICE_FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.004)
  if (nice) return `${whole || ''}${nice[1]}`
  return String(Math.round(q * 100) / 100)
}

/** "1½ cups flour, sifted" */
export function formatIngredient(i: Pick<Ingredient, 'qty' | 'unit' | 'name' | 'note'>): string {
  const head = [i.qty !== undefined ? formatQty(i.qty) : '', i.unit, i.name].filter(Boolean).join(' ')
  return i.note ? `${head}, ${i.note}` : head
}
