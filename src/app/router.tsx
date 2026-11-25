import { createBrowserRouter } from 'react-router'
import { LibraryScreen } from '@/features/library/LibraryScreen'
import { HomeScreen } from '@/features/recipes/HomeScreen'
import { RecipeDetailScreen } from '@/features/recipes/RecipeDetailScreen'
import { RecipeFormScreen } from '@/features/recipes/RecipeFormScreen'
import { DesignSystemScreen } from '@/features/settings/DesignSystemScreen'
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
        { path: 'studio', element: <StudioScreen /> },
        { path: 'library', element: <LibraryScreen /> },
        { path: 'settings', element: <SettingsScreen /> },
        { path: 'settings/design', element: <DesignSystemScreen /> },
        { path: '*', element: <HomeScreen /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)
