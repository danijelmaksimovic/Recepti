import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addAsset,
  createCollection,
  createRecipe,
  getRecipe,
  StorageError,
  totalMinutes,
  updateRecipe,
  type RecipeInput,
} from '@/db'
import { DIFFICULTY_LABELS, formatMinutes } from '@/domain/format'
import { ingredientsToLines, linesToIngredients } from '@/domain/ingredients'
import type { Difficulty, Id, Recipe } from '@/domain/types'
import { Button, IconButton } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { cx } from '@/ui/cx'
import { Icon } from '@/ui/Icon'
import { EmptyState, Page } from '@/ui/Page'
import { move, SortableList } from '@/ui/Sortable'
import { TagInput } from '@/ui/TagInput'
import { toast } from '@/ui/toast'
import { useAssetUrl, useBlobUrl, useCategories, useCollections } from './hooks'
import { preparePhoto, type PreparedPhoto } from './photo'

interface Line {
  id: string
  text: string
}

type PhotoState = { kind: 'none' } | { kind: 'existing'; assetId: Id } | { kind: 'new'; photo: PreparedPhoto }

interface Draft {
  name: string
  description: string
  photo: PhotoState
  ingredients: Line[]
  steps: Line[]
  prepMin: string
  cookMin: string
  totalOverride: string
  servings: string
  difficulty: Difficulty
  categoryId?: Id
  tags: string[]
  collectionIds: Id[]
  notes: string
  favorite: boolean
}

const uid = () => crypto.randomUUID()
const numText = (n: number | undefined) => (n === undefined ? '' : String(n))

function toDraft(r?: Recipe): Draft {
  return {
    name: r?.name ?? '',
    description: r?.description ?? '',
    photo: r?.photoAssetId ? { kind: 'existing', assetId: r.photoAssetId } : { kind: 'none' },
    ingredients: r ? ingredientsToLines(r.ingredients).map(({ id, text }) => ({ id, text })) : [],
    steps: r?.steps.map((s) => ({ id: s.id, text: s.text })) ?? [],
    prepMin: numText(r?.prepMin),
    cookMin: numText(r?.cookMin),
    totalOverride: numText(r?.totalOverride),
    servings: numText(r?.servings),
    difficulty: r?.difficulty ?? 'medium',
    categoryId: r?.categoryId,
    tags: r?.tags ?? [],
    collectionIds: r?.collectionIds ?? [],
    notes: r?.notes ?? '',
    favorite: r?.favorite === 1,
  }
}

/** Parse a number field. Blank is "not set"; anything else must be a non-negative number. */
function parseNum(v: string, label: string, errors: Record<string, string>, key: string): number | undefined {
  const t = v.trim().replace(',', '.')
  if (!t) return undefined
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) errors[key] = `${label} must be a number`
  return n
}

/** Go back if we came from inside the app, else to `fallback`. */
function useGoBack() {
  const navigate = useNavigate()
  return (fallback: string) => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}

/** Route `/recipes/new` and `/recipes/:id/edit`. */
export function RecipeFormScreen() {
  const { id } = useParams()
  const recipe = useLiveQuery(() => (id ? getRecipe(id).then((r) => r ?? null) : null), [id])
  if (id && recipe === undefined) return null
  if (id && !recipe)
    return (
      <Page back title="Edit recipe">
        <EmptyState title="Recipe not found" body="It may have been deleted." />
      </Page>
    )
  // Keyed so the form starts fresh from the stored recipe once it has loaded.
  return <RecipeForm key={id ?? 'new'} recipe={recipe ?? undefined} />
}

function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const initial = useMemo(() => toDraft(recipe), [recipe])
  const [draft, setDraft] = useState<Draft>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const { list: categories } = useCategories()
  const collections = useCollections()

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const editing = !!recipe

  const cancel = () => (dirty ? setConfirmDiscard(true) : goBack(editing ? `/recipes/${recipe.id}` : '/'))

  async function save() {
    const errs: Record<string, string> = {}
    if (!draft.name.trim()) errs.name = 'Give the recipe a name'
    const prepMin = parseNum(draft.prepMin, 'Prep time', errs, 'prepMin')
    const cookMin = parseNum(draft.cookMin, 'Cook time', errs, 'cookMin')
    const totalOverride = parseNum(draft.totalOverride, 'Total time', errs, 'totalOverride')
    const servings = parseNum(draft.servings, 'Servings', errs, 'servings')
    setErrors(errs)
    if (Object.keys(errs).length) {
      if (errs.name) nameRef.current?.focus()
      return
    }

    setSaving(true)
    try {
      // Main photo: keep, replace or remove. Other photos (used later by cards) are kept.
      const others = (recipe?.photoAssetIds ?? []).filter((a) => a !== recipe?.photoAssetId)
      let photoAssetId: Id | undefined
      if (draft.photo.kind === 'existing') photoAssetId = draft.photo.assetId
      else if (draft.photo.kind === 'new') {
        const { photo } = draft.photo
        photoAssetId = (await addAsset({ kind: 'photo', ...photo })).asset.id
      }

      const input: RecipeInput = {
        name: draft.name,
        description: draft.description,
        photoAssetId,
        photoAssetIds: photoAssetId ? [photoAssetId, ...others.filter((a) => a !== photoAssetId)] : others,
        ingredients: linesToIngredients(draft.ingredients),
        steps: draft.steps.map((s) => ({ id: s.id, text: s.text })),
        prepMin,
        cookMin,
        totalOverride,
        servings,
        difficulty: draft.difficulty,
        categoryId: draft.categoryId,
        tags: draft.tags,
        collectionIds: draft.collectionIds,
        notes: draft.notes,
        favorite: draft.favorite,
      }

      if (recipe) {
        await updateRecipe(recipe.id, input)
        toast('Recipe saved')
        goBack(`/recipes/${recipe.id}`)
      } else {
        const created = await createRecipe(input)
        toast('Recipe added')
        navigate(`/recipes/${created.id}`, { replace: true })
      }
    } catch (err) {
      // Storage failures already show a toast via onStorageError.
      if (!(err instanceof StorageError && ['StorageError', 'StorageFullError'].includes(err.name)))
        toast((err as Error).message, { tone: 'error' })
      setSaving(false)
    }
  }

  const computedTotal = totalMinutes({
    prepMin: Number(draft.prepMin) || undefined,
    cookMin: Number(draft.cookMin) || undefined,
  })

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Page
        title={editing ? 'Edit recipe' : 'New recipe'}
        actions={
          <>
            <Button type="button" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div className="space-y-4">
            <Card>
              <Field label="Name" htmlFor="f-name" error={errors.name}>
                <input
                  id="f-name"
                  ref={nameRef}
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Grandma's plum cake"
                  autoComplete="off"
                  autoCapitalize="sentences"
                  aria-invalid={!!errors.name}
                  className={cx(inputCls, 'font-display text-xl')}
                />
              </Field>
              <Field label="Short description" htmlFor="f-desc">
                <textarea
                  id="f-desc"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="A soft, buttery Sunday bake"
                  className={cx(inputCls, 'h-auto py-3')}
                />
              </Field>
            </Card>

            <Card title="Ingredients" hint="One per line, like “200 g flour, sifted”. End a line with “:” to start a group.">
              <LineEditor
                kind="ingredient"
                lines={draft.ingredients}
                onChange={(l) => set('ingredients', l)}
                placeholder="Add ingredient, e.g. 2 cups milk"
              />
            </Card>

            <Card title="Steps">
              <LineEditor kind="step" lines={draft.steps} onChange={(l) => set('steps', l)} placeholder="Describe the next step" />
            </Card>

            <Card title="Notes">
              <textarea
                aria-label="Notes"
                rows={3}
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Where it came from, what to change next time…"
                className={cx(inputCls, 'h-auto py-3')}
              />
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Photo">
              <PhotoPicker value={draft.photo} onChange={(p) => set('photo', p)} />
            </Card>

            <Card title="Time and servings">
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Prep (min)" id="f-prep" value={draft.prepMin} onChange={(v) => set('prepMin', v)} error={errors.prepMin} />
                <NumberField label="Cook (min)" id="f-cook" value={draft.cookMin} onChange={(v) => set('cookMin', v)} error={errors.cookMin} />
                <NumberField
                  label="Total (min)"
                  id="f-total"
                  value={draft.totalOverride}
                  onChange={(v) => set('totalOverride', v)}
                  placeholder={computedTotal ? String(computedTotal) : 'auto'}
                  error={errors.totalOverride}
                />
                <NumberField label="Servings" id="f-serv" value={draft.servings} onChange={(v) => set('servings', v)} error={errors.servings} />
              </div>
              {!draft.totalOverride && computedTotal ? (
                <p className="mt-2 text-sm text-ink-3">Total: {formatMinutes(computedTotal)} (prep + cook)</p>
              ) : null}
              <p className="mt-4 mb-2 text-sm font-medium text-ink-2">Difficulty</p>
              <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-3 gap-1 rounded-full bg-paper-2 p-1">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={draft.difficulty === d}
                    onClick={() => set('difficulty', d)}
                    className={cx(
                      'h-9 rounded-full text-sm font-medium transition',
                      draft.difficulty === d ? 'bg-surface text-ink shadow-card' : 'text-ink-2',
                    )}
                  >
                    {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Organize">
              <p className="mb-2 text-sm font-medium text-ink-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {categories?.map((c) => (
                  <Chip
                    type="button"
                    key={c.id}
                    selected={draft.categoryId === c.id}
                    onClick={() => set('categoryId', draft.categoryId === c.id ? undefined : c.id)}
                  >
                    {c.name}
                  </Chip>
                ))}
              </div>

              <p className="mt-5 mb-2 text-sm font-medium text-ink-2">Collections</p>
              <CollectionPicker
                collections={collections ?? []}
                value={draft.collectionIds}
                onChange={(ids) => set('collectionIds', ids)}
              />

              <label htmlFor="f-tags" className="mt-5 mb-2 block text-sm font-medium text-ink-2">
                Tags
              </label>
              <TagInput id="f-tags" value={draft.tags} onChange={(t) => set('tags', t)} />

              <label className="mt-5 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium">
                  <Icon name="heart" size={20} className="text-accent" fill={draft.favorite ? 'currentColor' : 'none'} />
                  Favorite
                </span>
                <input
                  type="checkbox"
                  checked={draft.favorite}
                  onChange={(e) => set('favorite', e.target.checked)}
                  className="size-6 accent-[var(--accent)]"
                />
              </label>
            </Card>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {editing ? 'Save changes' : 'Add recipe'}
          </Button>
        </div>
      </Page>

      <ConfirmSheet
        open={confirmDiscard}
        title="Discard changes?"
        body="What you typed here will be lost."
        confirmLabel="Discard"
        danger
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => goBack(editing ? `/recipes/${recipe.id}` : '/')}
      />
    </form>
  )
}

const inputCls =
  'block h-12 w-full rounded-2xl bg-surface px-4 ring-1 ring-line outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent aria-[invalid=true]:ring-danger'

function Card({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-card bg-paper-2/60 p-4 ring-1 ring-line/70 sm:p-5">
      {title && (
        <div>
          <h2 className="text-lg">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-ink-3">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function NumberField({
  label,
  id,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
}) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={inputCls}
      />
    </Field>
  )
}

/**
 * Editable, reorderable list of single-line ingredients or multi-line steps,
 * with a quick-entry box at the end. Pasting several lines adds one row each.
 */
function LineEditor({
  kind,
  lines,
  onChange,
  placeholder,
}: {
  kind: 'ingredient' | 'step'
  lines: Line[]
  onChange: (lines: Line[]) => void
  placeholder: string
}) {
  const [entry, setEntry] = useState('')
  const entryRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  const latest = useRef(lines)
  latest.current = lines

  const addTexts = (texts: string[]) => {
    const clean = texts.map((t) => t.trim()).filter(Boolean)
    if (clean.length) onChange([...latest.current, ...clean.map((text) => ({ id: uid(), text }))])
  }
  const update = (id: string, text: string) => onChange(latest.current.map((l) => (l.id === id ? { ...l, text } : l)))
  const remove = (id: string) => onChange(latest.current.filter((l) => l.id !== id))

  const isStep = kind === 'step'
  const noun = isStep ? 'step' : 'ingredient'

  return (
    <div>
      {lines.length > 0 && (
        <SortableList
          items={lines}
          className="mb-3 space-y-1"
          label={(_, i) => `Reorder ${noun} ${i + 1}`}
          onMove={(from, to) => onChange(move(latest.current, from, to))}
          renderItem={(line, i, handle) => {
            const heading = !isStep && line.text.trim().endsWith(':')
            return (
              <div className="flex items-start gap-1">
                {handle}
                {isStep && <span className="mt-2.5 w-6 shrink-0 text-center font-display text-lg text-accent">{i + 1}</span>}
                {isStep ? (
                  <textarea
                    aria-label={`Step ${i + 1}`}
                    value={line.text}
                    rows={Math.min(6, Math.max(2, Math.ceil(line.text.length / 30)))}
                    onChange={(e) => update(line.id, e.target.value)}
                    className={cx(inputCls, 'h-auto min-w-0 flex-1 py-2.5')}
                  />
                ) : (
                  <input
                    aria-label={`Ingredient ${i + 1}`}
                    value={line.text}
                    onChange={(e) => update(line.id, e.target.value)}
                    className={cx(inputCls, 'h-11 min-w-0 flex-1', heading && 'font-display font-semibold')}
                  />
                )}
                <IconButton type="button" icon="close" label={`Remove ${noun} ${i + 1}`} onClick={() => remove(line.id)} />
              </div>
            )
          }}
        />
      )}

      <div className="flex items-start gap-2">
        <span className="flex size-11 shrink-0 items-center justify-center text-ink-3">
          <Icon name="plus" />
        </span>
        {isStep ? (
          <textarea
            ref={entryRef}
            aria-label="New step"
            rows={2}
            value={entry}
            placeholder={placeholder}
            onChange={(e) => setEntry(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                addTexts([entry])
                setEntry('')
              }
            }}
            onBlur={() => {
              addTexts([entry])
              setEntry('')
            }}
            className={cx(inputCls, 'h-auto min-w-0 flex-1 py-2.5')}
          />
        ) : (
          <input
            ref={entryRef}
            aria-label="New ingredient"
            value={entry}
            enterKeyHint="enter"
            placeholder={placeholder}
            onChange={(e) => setEntry(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              if (text.includes('\n')) {
                e.preventDefault()
                addTexts(text.split(/\r?\n/))
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTexts([entry])
                setEntry('')
              }
            }}
            onBlur={() => {
              addTexts([entry])
              setEntry('')
            }}
            className={cx(inputCls, 'h-11 min-w-0 flex-1')}
          />
        )}
        <span className="w-11 shrink-0" />
      </div>
    </div>
  )
}

function PhotoPicker({ value, onChange }: { value: PhotoState; onChange: (p: PhotoState) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const existingUrl = useAssetUrl(value.kind === 'existing' ? value.assetId : undefined)
  const newUrl = useBlobUrl(value.kind === 'new' ? value.photo.thumb : undefined)
  const url = existingUrl ?? newUrl

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      onChange({ kind: 'new', photo: await preparePhoto(file) })
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {url ? (
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-line">
          <img src={url} alt="Recipe photo" className="aspect-[4/3] w-full object-cover" />
          <div className="absolute right-2 bottom-2 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              Replace
            </Button>
            <IconButton type="button" icon="trash" label="Remove photo" className="bg-surface" onClick={() => onChange({ kind: 'none' })} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-ink-2 transition hover:bg-surface"
        >
          <Icon name="camera" size={28} />
          <span className="font-medium">{busy ? 'Preparing photo…' : 'Add a photo'}</span>
        </button>
      )}
    </div>
  )
}

function CollectionPicker({
  collections,
  value,
  onChange,
}: {
  collections: { id: Id; name: string }[]
  value: Id[]
  onChange: (ids: Id[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const create = async () => {
    const n = name.trim()
    setAdding(false)
    setName('')
    if (!n) return
    const c = await createCollection({ name: n })
    onChange([...value, c.id])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {collections.map((c) => {
        const on = value.includes(c.id)
        return (
          <Chip type="button" key={c.id} selected={on} onClick={() => onChange(on ? value.filter((v) => v !== c.id) : [...value, c.id])}>
            {c.name}
          </Chip>
        )
      })}
      {adding ? (
        <input
          autoFocus
          aria-label="New collection name"
          value={name}
          placeholder="Collection name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void create()
            } else if (e.key === 'Escape') setAdding(false)
          }}
          onBlur={() => void create()}
          className="h-9 w-44 rounded-full bg-surface px-4 ring-2 ring-accent outline-none"
        />
      ) : (
        <Chip type="button" onClick={() => setAdding(true)} className="border border-dashed border-line !bg-transparent !ring-0">
          + New collection
        </Chip>
      )}
    </div>
  )
}
