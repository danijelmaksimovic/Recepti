// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { builtInCategoryId, createRecipe, getRecipe, listRecipes } from '@/db'
import { renderApp } from '@/test/render'

describe('recipe form', () => {
  it('asks for a name and saves nothing without one', async () => {
    const { user } = renderApp('/recipes/new')
    await user.click(await screen.findByRole('button', { name: 'Add recipe' }))
    expect(await screen.findByText('Give the recipe a name')).toBeTruthy()
    expect(await listRecipes()).toHaveLength(0)
  })

  it('creates a recipe with parsed ingredients, steps, category and tags', async () => {
    const { user, router } = renderApp('/recipes/new')
    await user.type(await screen.findByLabelText('Name'), 'Plum cake')
    const newIng = screen.getByLabelText('New ingredient')
    await user.type(newIng, '1 1/2 cups flour, sifted{Enter}')
    await user.type(newIng, '3 eggs{Enter}')
    await user.type(screen.getByLabelText('New step'), 'Mix everything{Enter}')
    await user.type(screen.getByLabelText('Prep (min)'), '15')
    await user.type(screen.getByLabelText('Cook (min)'), '40')
    await user.click(screen.getByRole('button', { name: 'Desserts' }))
    await user.type(screen.getByLabelText('Tags'), 'sunday{Enter}')
    await user.click(screen.getByRole('radio', { name: 'Easy' }))
    await user.click(screen.getByRole('button', { name: 'Add recipe' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/recipes\/[\w-]+$/))
    const [r] = await listRecipes()
    expect(r).toMatchObject({
      name: 'Plum cake',
      prepMin: 15,
      cookMin: 40,
      difficulty: 'easy',
      categoryId: builtInCategoryId('Desserts'),
      tags: ['sunday'],
    })
    expect(r.ingredients.map(({ qty, unit, name, note }) => ({ qty, unit, name, note }))).toEqual([
      { qty: 1.5, unit: 'cups', name: 'flour', note: 'sifted' },
      { qty: 3, unit: '', name: 'eggs', note: undefined },
    ])
    expect(r.steps.map((s) => s.text)).toEqual(['Mix everything'])

    // Lands on the detail screen showing the saved recipe.
    expect(await screen.findByRole('heading', { name: 'Plum cake' })).toBeTruthy()
    expect(screen.getByText('1½ cups flour, sifted')).toBeTruthy()
    expect(screen.getByText('55 min')).toBeTruthy()
  })

  it('edits an existing recipe and reorders ingredients from the keyboard', async () => {
    const r = await createRecipe({
      name: 'Soup',
      ingredients: [{ qty: 1, unit: 'l', name: 'water' }, { unit: '', name: 'salt' }],
    })
    const { user } = renderApp(`/recipes/${r.id}/edit`)
    const name = await screen.findByLabelText('Name')
    expect((name as HTMLInputElement).value).toBe('Soup')
    await user.clear(name)
    await user.type(name, 'Tomato soup')

    const grip = screen.getByRole('button', { name: 'Reorder ingredient 1' })
    grip.focus()
    await user.keyboard('{ArrowDown}')
    expect((screen.getByLabelText('Ingredient 1') as HTMLInputElement).value).toBe('salt')

    await user.click(screen.getByRole('button', { name: 'Remove ingredient 2' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(async () => expect((await getRecipe(r.id))?.name).toBe('Tomato soup'))
    const saved = await getRecipe(r.id)
    expect(saved?.ingredients.map((i) => i.name)).toEqual(['salt'])
    // Ingredient ids survive editing.
    expect(saved?.ingredients[0].id).toBe(r.ingredients[1].id)
  })

  it('asks before discarding unsaved changes', async () => {
    const { user, router } = renderApp('/recipes/new')
    await user.type(await screen.findByLabelText('Name'), 'Draft')
    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await listRecipes()).toHaveLength(0)
  })
})
