import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  createCategory,
  createCollection,
  deleteCategory,
  deleteCollection,
  listRecipes,
  reorderCategories,
  reorderCollections,
  updateCategory,
  updateCollection,
} from '@/db'
import type { Id } from '@/domain/types'
import { RenameSheet } from '@/features/collections/RenameSheet'
import { useCategories, useCollections } from '@/features/recipes/hooks'
import { Button, IconButton } from '@/ui/Button'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { Page, Section } from '@/ui/Page'
import { move, SortableList } from '@/ui/Sortable'

interface Item {
  id: Id
  name: string
  builtIn?: boolean
}

/** Settings › Categories and collections: add, rename, reorder and delete. */
export function OrganizeScreen() {
  const { list: categories } = useCategories()
  const collections = useCollections()
  const recipes = useLiveQuery(() => listRecipes(), [])

  const countIn = (kind: 'category' | 'collection', id: Id) =>
    (recipes ?? []).filter((r) => (kind === 'category' ? r.categoryId === id : r.collectionIds.includes(id))).length

  return (
    <Page back eyebrow="Settings" title="Categories & collections">
      <div className="grid gap-x-10 lg:grid-cols-2">
        <OrderedList
          title="Categories"
          noun="category"
          items={categories}
          count={(id) => countIn('category', id)}
          onCreate={(name) => createCategory({ name })}
          onRename={(id, name) => updateCategory(id, { name })}
          onDelete={deleteCategory}
          onReorder={reorderCategories}
          deleteBody="Recipes in it become uncategorized. They are not deleted."
        />
        <OrderedList
          title="Collections"
          noun="collection"
          items={collections}
          count={(id) => countIn('collection', id)}
          onCreate={(name) => createCollection({ name })}
          onRename={(id, name) => updateCollection(id, { name })}
          onDelete={deleteCollection}
          onReorder={reorderCollections}
          deleteBody="The recipes in it are kept; they just leave this collection."
          empty="Group recipes your own way: Family recipes, Weekend cooking, Recipes to try…"
        />
      </div>
    </Page>
  )
}

function OrderedList({
  title,
  noun,
  items,
  count,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  deleteBody,
  empty,
}: {
  title: string
  noun: string
  items: Item[] | undefined
  count: (id: Id) => number
  onCreate: (name: string) => Promise<unknown>
  onRename: (id: Id, name: string) => Promise<unknown>
  onDelete: (id: Id) => Promise<unknown>
  onReorder: (ids: Id[]) => Promise<unknown>
  deleteBody: string
  empty?: string
}) {
  // Local copy so dragging feels instant; re-synced whenever the database changes.
  const [order, setOrder] = useState<Item[]>([])
  const orderRef = useRef(order)
  orderRef.current = order
  useEffect(() => setOrder(items ?? []), [items])
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)

  return (
    <Section
      title={title}
      action={
        <Button variant="ghost" icon="plus" onClick={() => setAdding(true)} className="-mr-3">
          Add
        </Button>
      }
    >
      {order.length === 0 && empty ? (
        <p className="rounded-card border border-dashed border-line px-5 py-8 text-center text-ink-2">{empty}</p>
      ) : (
        <SortableList
          items={order}
          className="divide-y divide-line/70 rounded-card bg-surface px-1 ring-1 ring-line"
          label={(item) => `Reorder ${item.name}`}
          onMove={(from, to) => setOrder((o) => move(o, from, to))}
          onDrop={() => void onReorder(orderRef.current.map((i) => i.id))}
          renderItem={(item, _i, handle) => {
            const n = count(item.id)
            return (
              <div className="flex items-center gap-1 py-1">
                {handle}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-sm text-ink-3">
                    {n === 1 ? '1 recipe' : `${n} recipes`}
                    {item.builtIn && ' · built in'}
                  </p>
                </div>
                <IconButton icon="pen" label={`Rename ${item.name}`} onClick={() => setRenaming(item)} />
                {!item.builtIn && <IconButton icon="trash" label={`Delete ${item.name}`} onClick={() => setDeleting(item)} />}
              </div>
            )
          }}
        />
      )}

      <RenameSheet open={adding} title={`New ${noun}`} saveLabel="Add" onClose={() => setAdding(false)} onSave={onCreate} />
      <RenameSheet
        open={!!renaming}
        title={`Rename ${noun}`}
        initial={renaming?.name}
        onClose={() => setRenaming(null)}
        onSave={(name) => onRename(renaming!.id, name)}
      />
      <ConfirmSheet
        open={!!deleting}
        title={`Delete “${deleting?.name}”?`}
        body={deleteBody}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void onDelete(deleting.id)}
      />
    </Section>
  )
}
