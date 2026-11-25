import { createBrowserRouter } from 'react-router'
import { CollectionScreen } from '@/features/collections/CollectionScreen'
import { LibraryScreen } from '@/features/library/LibraryScreen'
import { HomeScreen } from '@/features/recipes/HomeScreen'
import { RecipeDetailScreen } from '@/features/recipes/RecipeDetailScreen'
import { RecipeFormScreen } from '@/features/recipes/RecipeFormScreen'
import { DesignSystemScreen } from '@/features/settings/DesignSystemScreen'
import { OrganizeScreen } from '@/features/settings/OrganizeScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { StudioScreen } from '@/features/studio/StudioScreen'
import { Shell } from './Shell'

export const router = createBrowserRouter(
  [
    {
      element: <Shell />,
      children: [
        { index: true, element: <HomeScreen /> },
        { path: 'recipes/new', element: <RecipeFormScreen /> },
        { path: 'recipes/:id', element: <RecipeDetailScreen /> },
        { path: 'recipes/:id/edit', element: <RecipeFormScreen /> },
        { path: 'collections/:id', element: <CollectionScreen /> },
        { path: 'studio', element: <StudioScreen /> },
        { path: 'library', element: <LibraryScreen /> },
        { path: 'settings', element: <SettingsScreen /> },
        { path: 'settings/organize', element: <OrganizeScreen /> },
        { path: 'settings/design', element: <DesignSystemScreen /> },
        { path: '*', element: <HomeScreen /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)
