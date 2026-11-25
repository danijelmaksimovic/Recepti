// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { builtInCategoryId, createRecipe, getRecipe, listCategories, listCollections } from '@/db'
import { renderApp } from '@/test/render'

describe('categories and collections', () => {
  it('adds, renames, reorders and deletes a custom category', async () => {
    const { user } = renderApp('/settings/organize')
    const [catAdd] = await screen.findAllByRole('button', { name: 'Add' })
    await user.click(catAdd)
    const add = await screen.findByRole('dialog', { name: 'New category' })
    await user.type(within(add).getByLabelText('Name'), 'Grill')
    await user.click(within(add).getByRole('button', { name: 'Add' }))
    await waitFor(async () => expect((await listCategories()).at(-1)?.name).toBe('Grill'))

    // Built-ins can be renamed but not deleted.
    expect(screen.queryByRole('button', { name: 'Delete Breakfast' })).toBeNull()
    await user.click(await screen.findByRole('button', { name: 'Rename Grill' }))
    const rename = await screen.findByRole('dialog', { name: 'Rename category' })
    const input = within(rename).getByLabelText('Name')
    await user.clear(input)
    await user.type(input, 'BBQ{Enter}')
    await waitFor(async () => expect((await listCategories()).at(-1)?.name).toBe('BBQ'))

    // Move BBQ up one place with the keyboard.
    const grip = await screen.findByRole('button', { name: 'Reorder BBQ' })
    grip.focus()
    await user.keyboard('{ArrowUp}')
    await waitFor(async () => expect((await listCategories()).map((c) => c.name).slice(-2)).toEqual(['BBQ', 'Other']))

    const recipe = await createRecipe({ name: 'Ribs', categoryId: (await listCategories()).find((c) => c.name === 'BBQ')!.id })
    await user.click(screen.getByRole('button', { name: 'Delete BBQ' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete “BBQ”?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect((await listCategories()).some((c) => c.name === 'BBQ')).toBe(false))
    expect((await getRecipe(recipe.id))?.categoryId).toBeUndefined()
    expect((await listCategories())[0].id).toBe(builtInCategoryId('Breakfast'))
  })

  it('creates a collection', async () => {
    const { user } = renderApp('/settings/organize')
    expect(await screen.findByText(/Group recipes your own way/)).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: 'Add' })[1])
    const add = await screen.findByRole('dialog', { name: 'New collection' })
    await user.type(within(add).getByLabelText('Name'), 'Family recipes{Enter}')
    await waitFor(async () => expect((await listCollections()).map((c) => c.name)).toEqual(['Family recipes']))
    expect(await screen.findByText('Family recipes')).toBeTruthy()
  })
})
