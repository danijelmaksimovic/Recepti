import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../types'
import { FIELDS, fieldValue, resolveText, token, tokensIn } from '../tokens'

const recipe: Recipe = {
  id: 'r1',
  name: 'Plum cake',
  description: 'Soft and buttery.',
  photoAssetIds: [],
  ingredients: [
    { id: 'a', qty: 200, unit: 'g', name: 'flour' },
    { id: 'b', qty: 0.5, unit: 'cup', name: 'sugar' },
    { id: 'c', qty: 80, unit: 'g', name: 'walnuts', group: 'Topping' },
  ],
  steps: [
    { id: 's1', text: 'Mix.' },
    { id: 's2', text: '  ' },
    { id: 's3', text: 'Bake.' },
  ],
  prepMin: 25,
  cookMin: 50,
  servings: 8,
  difficulty: 'easy',
  tags: ['autumn', 'baking'],
  collectionIds: [],
  notes: 'Best the next day.',
  favorite: 0,
  createdAt: 0,
  updatedAt: 0,
}
const ctx = { recipe, categoryName: 'Desserts' }

describe('recipe fields', () => {
  it('resolves every field', () => {
    expect(resolveText(token('name'), ctx)).toBe('Plum cake')
    expect(resolveText(token('preparationTime'), ctx)).toBe('25 min')
    expect(resolveText(token('cookTime'), ctx)).toBe('50 min')
    expect(resolveText(token('totalTime'), ctx)).toBe('1 h 15 min')
    expect(resolveText(token('servings'), ctx)).toBe('8')
    expect(resolveText(token('difficulty'), ctx)).toBe('Easy')
    expect(resolveText(token('category'), ctx)).toBe('Desserts')
    expect(resolveText(token('tags'), ctx)).toBe('autumn · baking')
    expect(resolveText(token('notes'), ctx)).toBe('Best the next day.')
    for (const f of FIELDS) expect(resolveText(token(f.key), ctx)).not.toContain('{{')
  })

  it('formats ingredient lists with group headings', () => {
    expect(resolveText(token('ingredients'), ctx)).toBe('• 200 g flour\n• ½ cup sugar\nTopping\n• 80 g walnuts')
    expect(resolveText(token('ingredients'), ctx, { listStyle: 'numbered' })).toBe('1. 200 g flour\n2. ½ cup sugar\nTopping\n3. 80 g walnuts')
    expect(resolveText(token('ingredients'), ctx, { listStyle: 'plain' })).toBe('200 g flour\n½ cup sugar\nTopping\n80 g walnuts')
  })

  it('numbers steps by default and skips blank ones', () => {
    expect(resolveText(token('steps'), ctx)).toBe('1. Mix.\n2. Bake.')
    expect(resolveText(token('steps'), ctx, { listStyle: 'bullets' })).toBe('• Mix.\n• Bake.')
  })

  it('mixes literal text and tokens, tolerating spaces and aliases', () => {
    expect(resolveText('Serves {{ recipe.servings }} · {{recipe.prepTime}}', ctx)).toBe('Serves 8 · 25 min')
    expect(resolveText('{{recipe.title}}', ctx)).toBe('Plum cake')
  })

  it('keeps unknown tokens visible', () => {
    expect(resolveText('{{recipe.colour}} and {{other.name}}', ctx)).toBe('{{recipe.colour}} and {{other.name}}')
  })

  it('drops separators left dangling by empty fields', () => {
    const bare = { recipe: { ...recipe, prepMin: undefined, cookMin: undefined } }
    expect(resolveText(`${token('category')}  ·  ${token('totalTime')}  ·  Serves 8`, bare)).toBe('Serves 8')
    expect(resolveText(`${token('category')}  ·  ${token('servings')}`, ctx)).toBe('Desserts  ·  8')
    expect(resolveText(`${token('category')} · Serves ${token('servings')}`, bare)).toBe('Serves 8')
  })

  it('uses total override when set', () => {
    expect(fieldValue('totalTime', { recipe: { ...recipe, totalOverride: 200 } })).toBe('3 h 20 min')
  })

  it('shows sample text without a recipe (template previews)', () => {
    expect(resolveText(token('name'), undefined)).toBe('Grandma’s apple pie')
  })

  it('lists the fields a text uses', () => {
    expect(tokensIn('{{recipe.name}} {{recipe.prep}} {{recipe.name}}')).toEqual(['name', 'preparationTime'])
  })
})
