import { describe, expect, it } from 'vitest'
import {
  formatIngredient,
  formatQty,
  ingredientsToLines,
  linesToIngredients,
  parseIngredientLine,
} from '@/domain/ingredients'

describe('parseIngredientLine', () => {
  it.each([
    ['200 g flour', { qty: 200, unit: 'g', name: 'flour' }],
    ['200g flour', { qty: 200, unit: 'g', name: 'flour' }],
    ['1 1/2 cups milk', { qty: 1.5, unit: 'cups', name: 'milk' }],
    ['1/2 tsp salt', { qty: 0.5, unit: 'tsp', name: 'salt' }],
    ['½ tsp salt', { qty: 0.5, unit: 'tsp', name: 'salt' }],
    ['1½ tbsp. sugar', { qty: 1.5, unit: 'tbsp', name: 'sugar' }],
    ['1,5 kg potatoes', { qty: 1.5, unit: 'kg', name: 'potatoes' }],
    ['3 eggs', { qty: 3, unit: '', name: 'eggs' }],
    ['2 cloves garlic, minced', { qty: 2, unit: 'cloves', name: 'garlic', note: 'minced' }],
    ['1 cup of rice', { qty: 1, unit: 'cup', name: 'rice' }],
    ['- 100 ml cream', { qty: 100, unit: 'ml', name: 'cream' }],
    ['Salt and pepper', { qty: undefined, unit: '', name: 'Salt and pepper' }],
    ['2-3 apples', { qty: undefined, unit: '', name: '2-3 apples' }],
    ['3 grams', { qty: undefined, unit: '', name: '3 grams' }],
  ])('%s', (line, expected) => {
    expect(parseIngredientLine(line)).toEqual(expected)
  })

  it('ignores blank lines and keeps a bare quantity as typed', () => {
    expect(parseIngredientLine('   ')).toBeUndefined()
    expect(parseIngredientLine('200 g')).toEqual({ qty: undefined, unit: '', name: '200 g' })
  })
})

describe('formatting', () => {
  it('shows friendly fractions', () => {
    expect(formatQty(1.5)).toBe('1½')
    expect(formatQty(0.25)).toBe('¼')
    expect(formatQty(1 / 3)).toBe('⅓')
    expect(formatQty(2)).toBe('2')
    expect(formatQty(1.37)).toBe('1.37')
  })

  it('formats an ingredient back to one line', () => {
    expect(formatIngredient({ qty: 1.5, unit: 'cups', name: 'flour', note: 'sifted' })).toBe('1½ cups flour, sifted')
    expect(formatIngredient({ unit: '', name: 'Salt' })).toBe('Salt')
  })
})

describe('group headings', () => {
  it('round-trips ingredients with groups through editor lines', () => {
    const lines = [
      { id: 'a', text: '200 g flour' },
      { id: 'h', text: 'For the sauce:' },
      { id: 'b', text: '1 cup cream' },
      { id: 'c', text: 'Salt' },
    ]
    const ings = linesToIngredients(lines)
    expect(ings).toEqual([
      { id: 'a', qty: 200, unit: 'g', name: 'flour' },
      { id: 'b', qty: 1, unit: 'cup', name: 'cream', group: 'For the sauce' },
      { id: 'c', qty: undefined, unit: '', name: 'Salt', group: 'For the sauce' },
    ])
    const back = ingredientsToLines(ings.map((i) => ({ ...i, id: i.id! })))
    expect(back.map((l) => l.text)).toEqual(['200 g flour', 'For the sauce:', '1 cup cream', 'Salt'])
  })
})
