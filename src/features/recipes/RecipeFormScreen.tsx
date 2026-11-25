import { EmptyState, Page } from '@/ui/Page'

export function RecipeFormScreen() {
  return (
    <Page back title="New recipe">
      <EmptyState title="Coming in Phase 4" body="The recipe form arrives once local storage (Phase 3) is in place." />
    </Page>
  )
}
