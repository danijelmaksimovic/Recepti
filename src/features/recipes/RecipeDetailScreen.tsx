import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { deleteRecipe, duplicateRecipe, getRecipe, setFavorite, setRecipeInCollection, totalMinutes } from '@/db'
import { DIFFICULTY_LABELS, formatDate, formatMinutes } from '@/domain/format'
import { formatIngredient } from '@/domain/ingredients'
import type { Ingredient, Recipe } from '@/domain/types'
import { IconButton } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { ConfirmSheet, SheetAction } from '@/ui/ConfirmSheet'
import { cx } from '@/ui/cx'
import { Icon, type IconName } from '@/ui/Icon'
import { EmptyState, Page } from '@/ui/Page'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { useAssetUrl, useCategories, useCollections } from './hooks'

export function RecipeDetailScreen() {
  const { id = '' } = useParams()
  const recipe = useLiveQuery(() => getRecipe(id).then((r) => r ?? null), [id])
  if (recipe === undefined) return null
  if (!recipe)
    return (
      <Page back title="Recipe">
        <EmptyState title="Recipe not found" body="It may have been deleted." />
      </Page>
    )
  return <RecipeDetail recipe={recipe} />
}

function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const navigate = useNavigate()
  const { byId: categoryById } = useCategories()
  const collections = useCollections()
  const photo = useAssetUrl(recipe.photoAssetId, 'full')
  const [menu, setMenu] = useState(false)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const category = recipe.categoryId ? categoryById.get(recipe.categoryId) : undefined
  const total = totalMinutes(recipe)
  const inCollections = (collections ?? []).filter((c) => recipe.collectionIds.includes(c.id))
  const fav = recipe.favorite === 1

  const duplicate = async () => {
    setMenu(false)
    const copy = await duplicateRecipe(recipe.id)
    toast('Recipe duplicated')
    navigate(`/recipes/${copy.id}`)
  }
  const remove = async () => {
    await deleteRecipe(recipe.id)
    toast('Recipe deleted')
    navigate('/', { replace: true })
  }

  return (
    <Page
      back
      title={recipe.name}
      eyebrow={category?.name}
      actions={
        <>
          <IconButton
            icon="heart"
            label={fav ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={fav}
            className={fav ? 'text-accent [&_svg]:fill-current' : undefined}
            onClick={() => void setFavorite(recipe.id, !fav)}
          />
          <IconButton icon="pen" label="Edit recipe" onClick={() => navigate(`/recipes/${recipe.id}/edit`)} />
          <IconButton icon="more" label="More actions" onClick={() => setMenu(true)} />
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-6">
          <div className={cx('overflow-hidden rounded-card shadow-card ring-1 ring-line/60', !photo && 'bg-accent-soft')}>
            {photo ? (
              <img src={photo} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center p-8">
                <p className="text-center font-display text-3xl leading-tight text-ink/80 italic">{recipe.name}</p>
              </div>
            )}
          </div>
          {recipe.description && <p className="mt-4 font-display text-xl leading-snug text-ink-2 italic">{recipe.description}</p>}

          <dl className="mt-4 grid grid-cols-3 gap-2">
            <Stat icon="clock" label="Total" value={formatMinutes(total)} />
            <Stat icon="users" label="Serves" value={recipe.servings !== undefined ? String(recipe.servings) : undefined} />
            <Stat icon="gauge" label="Difficulty" value={DIFFICULTY_LABELS[recipe.difficulty]} />
          </dl>
          {(recipe.prepMin !== undefined || recipe.cookMin !== undefined) && (
            <p className="mt-2 text-sm text-ink-3">
              {[recipe.prepMin !== undefined && `Prep ${formatMinutes(recipe.prepMin)}`, recipe.cookMin !== undefined && `Cook ${formatMinutes(recipe.cookMin)}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {(recipe.tags.length > 0 || inCollections.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {inCollections.map((c) => (
                <Link key={c.id} to={`/collections/${c.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-herb-soft px-3 text-sm font-medium text-herb">
                  <Icon name="folder" size={15} /> {c.name}
                </Link>
              ))}
              {recipe.tags.map((t) => (
                <span key={t} className="inline-flex h-8 items-center rounded-full bg-paper-2 px-3 text-sm text-ink-2">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-8">
          <Block title="Ingredients">
            {recipe.ingredients.length ? <IngredientList items={recipe.ingredients} /> : <Muted>No ingredients yet.</Muted>}
          </Block>

          <Block title="Preparation">
            {recipe.steps.length ? (
              <ol className="space-y-4">
                {recipe.steps.map((s, i) => (
                  <li key={s.id} className="flex gap-4">
                    <span className="font-display text-2xl leading-none text-accent">{i + 1}</span>
                    <p className="pt-0.5 leading-relaxed whitespace-pre-line">{s.text}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <Muted>No steps yet.</Muted>
            )}
          </Block>

          {recipe.notes.trim() && (
            <Block title="Notes">
              <p className="rounded-2xl bg-accent-soft/60 p-4 leading-relaxed whitespace-pre-line">{recipe.notes}</p>
            </Block>
          )}

          <Block title="Recipe cards">
            <div className="flex items-center gap-4 rounded-2xl border border-dashed border-line p-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon name="palette" />
              </span>
              <p className="text-sm text-ink-2">Designing cards for this recipe arrives with the Design Studio in the next phase.</p>
            </div>
          </Block>

          <p className="text-sm text-ink-3">
            Added {formatDate(recipe.createdAt)}
            {recipe.updatedAt - recipe.createdAt > 60_000 && ` · Edited ${formatDate(recipe.updatedAt)}`}
          </p>
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={recipe.name}>
        <SheetAction icon={<Icon name="pen" />} label="Edit" onClick={() => navigate(`/recipes/${recipe.id}/edit`)} />
        <SheetAction icon={<Icon name="copy" />} label="Duplicate" onClick={() => void duplicate()} />
        <SheetAction
          icon={<Icon name="folder" />}
          label="Add to collections"
          onClick={() => {
            setMenu(false)
            setCollectionsOpen(true)
          }}
        />
        <SheetAction
          danger
          icon={<Icon name="trash" />}
          label="Delete"
          onClick={() => {
            setMenu(false)
            setConfirmDelete(true)
          }}
        />
      </Sheet>

      <Sheet open={collectionsOpen} onClose={() => setCollectionsOpen(false)} title="Collections">
        {collections?.length ? (
          <div className="flex flex-wrap gap-2">
            {collections.map((c) => {
              const on = recipe.collectionIds.includes(c.id)
              return (
                <Chip key={c.id} selected={on} onClick={() => void setRecipeInCollection(recipe.id, c.id, !on)}>
                  {on && <Icon name="check" size={15} className="mr-1 inline -translate-y-px" />}
                  {c.name}
                </Chip>
              )
            })}
          </div>
        ) : (
          <p className="text-ink-2">You have no collections yet.</p>
        )}
        <Link to="/settings/organize" className="mt-5 inline-flex items-center gap-1 font-medium text-accent">
          Manage collections <Icon name="chevronRight" size={18} />
        </Link>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title="Delete this recipe?"
        body={`“${recipe.name}” and its card designs will be removed from this device. Photos used elsewhere are kept.`}
        confirmLabel="Delete recipe"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </Page>
  )
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
        <Icon name={icon} size={15} /> {label}
      </dt>
      <dd className="mt-1 font-medium">{value ?? '—'}</dd>
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-ink-3">{children}</p>
}

/** Ingredients grouped under their headings. Tap to tick one off while cooking (not saved). */
function IngredientList({ items }: { items: Ingredient[] }) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const groups: { name?: string; items: Ingredient[] }[] = []
  for (const i of items) {
    const last = groups.at(-1)
    if (last && last.name === i.group) last.items.push(i)
    else groups.push({ name: i.group, items: [i] })
  }
  const toggle = (id: string) =>
    setDone((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })

  return (
    <div className="space-y-5">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.name && <h3 className="mb-1.5 text-lg text-ink-2 italic">{g.name}</h3>}
          <ul className="divide-y divide-line/70">
            {g.items.map((i) => {
              const checked = done.has(i.id)
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(i.id)}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                  >
                    <span
                      className={cx(
                        'flex size-5 shrink-0 items-center justify-center rounded-md ring-1 transition',
                        checked ? 'bg-herb text-paper ring-herb' : 'ring-line',
                      )}
                    >
                      {checked && <Icon name="check" size={14} strokeWidth={2.5} />}
                    </span>
                    <span className={cx('transition', checked && 'text-ink-3 line-through')}>{formatIngredient(i)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
