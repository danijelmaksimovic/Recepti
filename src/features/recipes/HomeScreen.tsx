import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes, type RecipeSort } from '@/db'
import type { Collection, Id, Recipe } from '@/domain/types'
import { CookbookArt } from '@/ui/Art'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Icon } from '@/ui/Icon'
import { EmptyState, Page, Section } from '@/ui/Page'
import { useCategories, useCollections, useStoredState } from './hooks'
import { RecipeCard } from './RecipeCard'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const SORTS: { value: RecipeSort; label: string }[] = [
  { value: 'updated', label: 'Recently edited' },
  { value: 'created', label: 'Recently added' },
  { value: 'name', label: 'A to Z' },
]

/** Category chip value: a category id, "all" or "favorites". */
type Filter = 'all' | 'favorites' | Id

export function HomeScreen() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [sort, setSort] = useStoredState<RecipeSort>('home.sort', 'updated', ['updated', 'created', 'name'])
  const { list: categories, byId: categoryById } = useCategories()
  const collections = useCollections()

  const all = useLiveQuery(() => listRecipes(), [])
  const results = useLiveQuery(
    () =>
      listRecipes({
        sort,
        search: deferredSearch,
        favoritesOnly: filter === 'favorites',
        categoryId: filter !== 'all' && filter !== 'favorites' ? filter : undefined,
      }),
    [sort, deferredSearch, filter],
  )

  const loading = all === undefined
  const empty = all?.length === 0
  const filtering = filter !== 'all' || deferredSearch.trim() !== ''
  const favorites = all?.filter((r) => r.favorite === 1) ?? []
  const catName = (r: Recipe) => (r.categoryId ? categoryById.get(r.categoryId)?.name : undefined)

  return (
    <Page eyebrow={greeting()} title="My Cookbook">
      {!empty && (
        <>
          <label className="flex h-12 items-center gap-2.5 rounded-full bg-surface px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent">
            <Icon name="search" className="text-ink-3" />
            <span className="sr-only">Search recipes</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes, ingredients, tags"
              className="w-full bg-transparent outline-none placeholder:text-ink-3"
            />
          </label>

          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
            <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </Chip>
            <Chip selected={filter === 'favorites'} onClick={() => setFilter('favorites')}>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="heart" size={15} fill="currentColor" /> Favorites
              </span>
            </Chip>
            {categories?.map((c) => (
              <Chip key={c.id} selected={filter === c.id} onClick={() => setFilter(filter === c.id ? 'all' : c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </>
      )}

      {loading ? null : empty ? (
        <div className="mt-4">
          <EmptyState
            art={<CookbookArt />}
            title="Your cookbook is waiting"
            body="Add your first recipe, then design a card for it in the Studio. Everything stays on this device."
            action={
              <Button icon="plus" size="lg" onClick={() => navigate('/recipes/new')}>
                Add a recipe
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {!filtering && all.length >= 4 && favorites.length > 0 && (
            <Section title="Favorites">
              <Shelf recipes={favorites} catName={catName} />
            </Section>
          )}
          {!filtering && collections && collections.length > 0 && <CollectionsRow collections={collections} recipes={all} />}

          <Section
            title={filtering ? resultTitle(results?.length) : 'All recipes'}
            action={
              <label className="relative inline-flex items-center gap-1.5 text-sm font-medium text-ink-2">
                <Icon name="sort" size={16} />
                <span className="sr-only">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as RecipeSort)}
                  className="appearance-none bg-transparent pr-1 font-medium outline-none"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            {results && results.length === 0 ? (
              <p className="rounded-card border border-dashed border-line px-6 py-10 text-center text-ink-2">
                {filter === 'favorites' && !deferredSearch
                  ? 'No favorites yet. Tap the heart on a recipe to keep it here.'
                  : 'Nothing matches. Try another word or category.'}
              </p>
            ) : (
              <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
                {results?.map((r) => (
                  <RecipeCard key={r.id} recipe={r} categoryName={catName(r)} className="mb-4" />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </Page>
  )
}

function resultTitle(n: number | undefined) {
  if (n === undefined) return 'Results'
  return n === 1 ? '1 recipe' : `${n} recipes`
}

/** A horizontally scrolling row of recipe tiles. */
function Shelf({ recipes, catName }: { recipes: Recipe[]; catName: (r: Recipe) => string | undefined }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      {recipes.slice(0, 12).map((r) => (
        <div key={r.id} className="w-40 shrink-0 snap-start sm:w-48">
          <RecipeCard recipe={r} categoryName={catName(r)} />
        </div>
      ))}
    </div>
  )
}

function CollectionsRow({ collections, recipes }: { collections: Collection[]; recipes: Recipe[] }) {
  const count = (id: Id) => recipes.filter((r) => r.collectionIds.includes(id)).length
  return (
    <Section
      title="Collections"
      action={
        <Link to="/settings/organize" className="text-sm font-medium text-accent">
          Manage
        </Link>
      }
    >
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
        {collections.map((c) => (
          <Link
            key={c.id}
            to={`/collections/${c.id}`}
            className="flex w-44 shrink-0 items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line transition hover:bg-paper-2"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-herb-soft text-herb">
              <Icon name="folder" size={20} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="text-sm text-ink-3">{count(c.id) === 1 ? '1 recipe' : `${count(c.id)} recipes`}</span>
            </span>
          </Link>
        ))}
      </div>
    </Section>
  )
}
