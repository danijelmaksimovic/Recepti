/**
 * Recipe placeholders (BLUEPRINT §4). Card text keeps its `sourceText` with
 * tokens such as `{{recipe.name}}`; what you see on the card is resolved from
 * the current recipe each time it is drawn, so the same design or template
 * shows any recipe's content and never stores it.
 */
import { DIFFICULTY_LABELS, formatMinutes } from '../format'
import { formatIngredient } from '../ingredients'
import type { Recipe } from '../types'

export type ListStyle = 'bullets' | 'numbered' | 'plain'

export interface FieldDef {
  key: string
  label: string
  /** Multi-line list fields accept a list style. */
  list?: boolean
  /** Shown in the field picker; also used for templates without a recipe. */
  sample: string
}

/** Fields offered in the Studio, in picker order. */
export const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Recipe name', sample: 'Grandma’s apple pie' },
  { key: 'description', label: 'Description', sample: 'Flaky, buttery and not too sweet.' },
  { key: 'ingredients', label: 'Ingredients', list: true, sample: '• 3 apples\n• 200 g flour' },
  { key: 'steps', label: 'Steps', list: true, sample: '1. Peel the apples.\n2. Bake for 45 min.' },
  { key: 'preparationTime', label: 'Prep time', sample: '20 min' },
  { key: 'cookTime', label: 'Cook time', sample: '45 min' },
  { key: 'totalTime', label: 'Total time', sample: '1 h 5 min' },
  { key: 'servings', label: 'Servings', sample: '8' },
  { key: 'difficulty', label: 'Difficulty', sample: 'Easy' },
  { key: 'category', label: 'Category', sample: 'Desserts' },
  { key: 'tags', label: 'Tags', sample: 'autumn · baking' },
  { key: 'notes', label: 'Notes', sample: 'Best the next day.' },
]

/** Other spellings people may type. */
const ALIASES: Record<string, string> = {
  title: 'name',
  prepTime: 'preparationTime',
  prep: 'preparationTime',
  cook: 'cookTime',
  time: 'totalTime',
  total: 'totalTime',
  serves: 'servings',
  method: 'steps',
  instructions: 'steps',
}

export function fieldKey(key: string): string {
  return ALIASES[key] ?? key
}

export function getField(key: string): FieldDef | undefined {
  const k = fieldKey(key)
  return FIELDS.find((f) => f.key === k)
}

export const token = (key: string) => `{{recipe.${key}}}`

const TOKEN_RE = /\{\{\s*recipe\.([A-Za-z]+)\s*\}\}/g

/** Field keys used in a text, de-duplicated, in order. */
export function tokensIn(text: string): string[] {
  const keys = new Set<string>()
  for (const m of text.matchAll(TOKEN_RE)) keys.add(fieldKey(m[1]))
  return [...keys]
}

export function defaultListStyle(key: string): ListStyle {
  return fieldKey(key) === 'steps' ? 'numbered' : 'bullets'
}

export interface TokenContext {
  recipe: Recipe
  categoryName?: string
}

export interface ResolveOptions {
  /** List style for list fields; each field's default when omitted. */
  listStyle?: ListStyle
}

function formatList(items: string[], style: ListStyle): string {
  return items.map((t, i) => (style === 'bullets' ? `• ${t}` : style === 'numbered' ? `${i + 1}. ${t}` : t)).join('\n')
}

function ingredientsText(recipe: Recipe, style: ListStyle): string {
  const lines: string[] = []
  let group: string | undefined
  let n = 0
  for (const ing of recipe.ingredients) {
    if ((ing.group ?? undefined) !== group) {
      group = ing.group
      if (group) lines.push(group)
    }
    const text = formatIngredient(ing)
    lines.push(style === 'bullets' ? `• ${text}` : style === 'numbered' ? `${++n}. ${text}` : text)
  }
  return lines.join('\n')
}

/** The display value of one field for a recipe ('' when the recipe has none). */
export function fieldValue(key: string, ctx: TokenContext, opts: ResolveOptions = {}): string {
  const { recipe } = ctx
  const k = fieldKey(key)
  const style = opts.listStyle ?? defaultListStyle(k)
  switch (k) {
    case 'name':
      return recipe.name
    case 'description':
      return recipe.description
    case 'ingredients':
      return ingredientsText(recipe, style)
    case 'steps':
      return formatList(
        recipe.steps.map((s) => s.text.trim()).filter(Boolean),
        style,
      )
    case 'preparationTime':
      return formatMinutes(recipe.prepMin) ?? ''
    case 'cookTime':
      return formatMinutes(recipe.cookMin) ?? ''
    case 'totalTime': {
      const total = recipe.totalOverride ?? (recipe.prepMin !== undefined || recipe.cookMin !== undefined ? (recipe.prepMin ?? 0) + (recipe.cookMin ?? 0) : undefined)
      return formatMinutes(total) ?? ''
    }
    case 'servings':
      return recipe.servings !== undefined ? String(recipe.servings) : ''
    case 'difficulty':
      return DIFFICULTY_LABELS[recipe.difficulty] ?? ''
    case 'category':
      return ctx.categoryName ?? ''
    case 'tags':
      return recipe.tags.join(' · ')
    case 'notes':
      return recipe.notes
    default:
      return ''
  }
}

/**
 * Replace every `{{recipe.*}}` token in `source`. Unknown tokens stay as
 * typed, so a misspelling is visible on the card instead of vanishing.
 * Without a recipe (template previews) each field shows its sample text.
 */
export function resolveText(source: string, ctx: TokenContext | undefined, opts: ResolveOptions = {}): string {
  let emptied = false
  const out = source.replace(TOKEN_RE, (whole, key: string) => {
    const field = getField(key)
    if (!field) return whole
    const v = ctx ? fieldValue(field.key, ctx, opts) : field.sample
    if (!v) emptied = true
    return v
  })
  return emptied ? tidySeparators(out) : out
}

/** "  ·  1 h  ·  " → "1 h": drop "·" separators left dangling by empty fields. */
function tidySeparators(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!line.includes('·')) return line
      const parts = line.split('·')
      const kept = parts.filter((p) => p.trim())
      if (kept.length === parts.length) return line
      const gap = /(\s*)·(\s*)/.exec(line)!
      return kept.map((p) => p.trim()).join(`${gap[1] || ' '}·${gap[2] || ' '}`)
    })
    .join('\n')
}
