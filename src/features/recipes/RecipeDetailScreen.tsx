import { EmptyState, Page } from '@/ui/Page'

export function RecipeDetailScreen() {
  return (
    <Page back title="Recipe">
      <EmptyState title="Recipe not found" body="Recipes will appear here once storage is built in Phase 3." />
    </Page>
  )
}
