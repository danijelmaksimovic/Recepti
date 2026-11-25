// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { builtInCategoryId, createCollection, createRecipe, getRecipe, listRecipes } from '@/db'
import { renderApp } from '@/test/render'

const tick = () => new Promise((r) => setTimeout(r, 3))
const titles = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('home screen', () => {
  it('shows the empty state when there are no recipes', async () => {
    renderApp('/')
    expect(await screen.findByText('Your cookbook is waiting')).toBeTruthy()
  })

  it('lists, searches, filters by category and favorites, and sorts', async () => {
    await createRecipe({ name: 'Banana bread', categoryId: builtInCategoryId('Bakery'), ingredients: [{ unit: '', name: 'banana' }] })
    await tick()
    await createRecipe({ name: 'Apple pie', categoryId: builtInCategoryId('Desserts'), favorite: true })
    await tick()
    await createRecipe({ name: 'Chicken soup', categoryId: builtInCategoryId('Soups'), tags: ['winter'] })
    const { user } = renderApp('/')

    await waitFor(() => expect(titles()).toEqual(['Chicken soup', 'Apple pie', 'Banana bread']))

    await user.selectOptions(screen.getByLabelText('Sort'), 'name')
    await waitFor(() => expect(titles()).toEqual(['Apple pie', 'Banana bread', 'Chicken soup']))

    // Search matches ingredient names and tags too.
    const search = screen.getByLabelText('Search recipes')
    await user.type(search, 'banana')
    await waitFor(() => expect(titles()).toEqual(['Banana bread']))
    await user.clear(search)
    await user.type(search, 'winter')
    await waitFor(() => expect(titles()).toEqual(['Chicken soup']))
    await user.clear(search)

    await user.click(screen.getByRole('button', { name: 'Desserts' }))
    await waitFor(() => expect(titles()).toEqual(['Apple pie']))
    await user.click(screen.getByRole('button', { name: 'Favorites' }))
    await waitFor(() => expect(titles()).toEqual(['Apple pie']))
    await user.click(screen.getByRole('button', { name: 'Soups' }))
    await waitFor(() => expect(titles()).toEqual(['Chicken soup']))
  })
})

describe('recipe detail', () => {
  it('toggles favorite, duplicates and deletes', async () => {
    const r = await createRecipe({
      name: 'Pancakes',
      ingredients: [{ qty: 200, unit: 'g', name: 'flour' }, { qty: 2, unit: '', name: 'eggs', group: 'Wet' }],
      steps: [{ text: 'Whisk' }, { text: 'Fry' }],
      servings: 4,
      notes: 'Best with maple syrup',
    })
    const { user, router } = renderApp(`/recipes/${r.id}`)

    expect(await screen.findByRole('heading', { name: 'Pancakes' })).toBeTruthy()
    expect(screen.getByText('200 g flour')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Wet' })).toBeTruthy()
    expect(screen.getByText('Fry')).toBeTruthy()
    expect(screen.getByText('Best with maple syrup')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))
    await waitFor(async () => expect((await getRecipe(r.id))?.favorite).toBe(1))
    expect(await screen.findByRole('button', { name: 'Remove from favorites' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(await screen.findByRole('heading', { name: 'Pancakes (copy)' })).toBeTruthy()
    expect(await listRecipes()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this recipe?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete recipe' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect((await listRecipes()).map((x) => x.name)).toEqual(['Pancakes'])
  })

  it('adds the recipe to a collection and the collection screen lists it', async () => {
    const r = await createRecipe({ name: 'Lasagna' })
    const c = await createCollection({ name: 'Italian food' })
    const { user, router } = renderApp(`/recipes/${r.id}`)

    await user.click(await screen.findByRole('button', { name: 'More actions' }))
    await user.click(screen.getByRole('button', { name: 'Add to collections' }))
    await user.click(screen.getByRole('button', { name: 'Italian food' }))
    await waitFor(async () => expect((await getRecipe(r.id))?.collectionIds).toEqual([c.id]))

    await router.navigate(`/collections/${c.id}`)
    expect(await screen.findByRole('heading', { name: 'Italian food' })).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Lasagna' })).toBeTruthy()
  })
})
