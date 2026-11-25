import { cleanup, render } from '@testing-library/react'
import { afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { CollectionScreen } from '@/features/collections/CollectionScreen'
import { HomeScreen } from '@/features/recipes/HomeScreen'
import { RecipeDetailScreen } from '@/features/recipes/RecipeDetailScreen'
import { RecipeFormScreen } from '@/features/recipes/RecipeFormScreen'
import { OrganizeScreen } from '@/features/settings/OrganizeScreen'
import { Toaster } from '@/app/Toaster'

afterEach(cleanup)

/** Render the app's recipe routes in memory, starting at `path`. */
export function renderApp(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <Outlet />
            <Toaster />
          </>
        ),
        children: [
          { path: '/', element: <HomeScreen /> },
          { path: '/recipes/new', element: <RecipeFormScreen /> },
          { path: '/recipes/:id', element: <RecipeDetailScreen /> },
          { path: '/recipes/:id/edit', element: <RecipeFormScreen /> },
          { path: '/collections/:id', element: <CollectionScreen /> },
          { path: '/settings/organize', element: <OrganizeScreen /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  const user = userEvent.setup()
  const utils = render(<RouterProvider router={router} />)
  return { ...utils, user, router }
}
