import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { deleteCollection, getCollection, listRecipes, updateCollection } from '@/db'
import type { Collection } from '@/domain/types'
import { useCategories } from '@/features/recipes/hooks'
import { RecipeCard } from '@/features/recipes/RecipeCard'
import { IconButton } from '@/ui/Button'
import { ConfirmSheet, SheetAction } from '@/ui/ConfirmSheet'
import { Icon } from '@/ui/Icon'
import { EmptyState, Page } from '@/ui/Page'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { RenameSheet } from './RenameSheet'

export function CollectionScreen() {
  const { id = '' } = useParams()
  const collection = useLiveQuery(() => getCollection(id).then((c) => c ?? null), [id])
  if (collection === undefined) return null
  if (!collection)
    return (
      <Page back title="Collection">
        <EmptyState title="Collection not found" body="It may have been deleted." />
      </Page>
    )
  return <CollectionView collection={collection} />
}

function CollectionView({ collection }: { collection: Collection }) {
  const navigate = useNavigate()
  const recipes = useLiveQuery(() => listRecipes({ collectionId: collection.id, sort: 'name' }), [collection.id])
  const { byId } = useCategories()
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <Page back eyebrow="Collection" title={collection.name} actions={<IconButton icon="more" label="More actions" onClick={() => setMenu(true)} />}>
      {recipes && recipes.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="Open a recipe, tap ⋯ and choose Add to collections, or pick collections while editing it."
        />
      ) : (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {recipes?.map((r) => (
            <RecipeCard key={r.id} recipe={r} categoryName={r.categoryId ? byId.get(r.categoryId)?.name : undefined} className="mb-4" />
          ))}
        </div>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={collection.name}>
        <SheetAction
          icon={<Icon name="pen" />}
          label="Rename"
          onClick={() => {
            setMenu(false)
            setRenaming(true)
          }}
        />
        <SheetAction
          danger
          icon={<Icon name="trash" />}
          label="Delete collection"
          onClick={() => {
            setMenu(false)
            setConfirmDelete(true)
          }}
        />
      </Sheet>
      <RenameSheet
        open={renaming}
        title="Rename collection"
        initial={collection.name}
        onClose={() => setRenaming(false)}
        onSave={(name) => updateCollection(collection.id, { name })}
      />
      <ConfirmSheet
        open={confirmDelete}
        title="Delete this collection?"
        body="The recipes in it are kept; they just leave this collection."
        confirmLabel="Delete collection"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteCollection(collection.id)
          toast('Collection deleted')
          navigate('/', { replace: true })
        }}
      />
    </Page>
  )
}
