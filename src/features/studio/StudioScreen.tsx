import { useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecentDesigns, listRecipes } from '@/db'
import type { Design, Recipe } from '@/domain/types'
import { useBlobUrl } from '@/features/recipes/hooks'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { EmptyState, Page } from '@/ui/Page'
import { Sheet } from '@/ui/Sheet'
import { NewCardSheet } from './NewCardSheet'

const starters: { name: string; className: string }[] = [
  { name: 'Minimalist', className: 'bg-surface font-sans not-italic tracking-tight' },
  { name: 'Vintage Cookbook', className: 'bg-[#efe1c6] text-[#5a3a22]' },
  { name: 'Modern Editorial', className: 'bg-ink text-paper not-italic' },
  { name: 'Rustic Kitchen', className: 'bg-[#d9c3a3] text-[#3e2c1c]' },
  { name: 'Scrapbook', className: 'bg-accent-soft' },
  { name: 'Elegant Handwritten', className: 'bg-paper-2' },
  { name: 'Colorful Playful', className: 'bg-herb-soft text-herb' },
]

export function StudioScreen() {
  const designs = useLiveQuery(() => listRecentDesigns(24), [])
  const recipes = useLiveQuery(() => listRecipes({ sort: 'name' }), [])
  const recipeById = new Map((recipes ?? []).map((r) => [r.id, r]))
  const [picking, setPicking] = useState(false)
  const [forRecipe, setForRecipe] = useState<Recipe>()

  return (
    <Page
      eyebrow="Design Studio"
      title="Recipe cards"
      actions={
        recipes?.length ? (
          <Button icon="plus" onClick={() => setPicking(true)}>
            New card
          </Button>
        ) : undefined
      }
    >
      {designs === undefined ? null : designs.length ? (
        <>
          <h2 className="mb-3 text-xl">Recent cards</h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {designs.map((d) => (
              <li key={d.id}>
                <CardTile design={d} recipe={recipeById.get(d.recipeId)} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          title="No cards yet"
          body={recipes?.length ? 'Pick a recipe and design a card for it from fonts, colours, textures and the recipe’s own fields.' : 'Add a recipe first, then design cards for it here.'}
          action={
            recipes?.length ? (
              <Button icon="plus" onClick={() => setPicking(true)}>
                Design a card
              </Button>
            ) : (
              <Link to="/recipes/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-ink">
                <Icon name="plus" size={20} /> New recipe
              </Link>
            )
          }
        />
      )}

      <h2 className="mt-10 mb-3 text-xl">Starter templates</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
        {starters.map((s) => (
          <figure key={s.name} className="w-32 shrink-0 snap-start lg:w-auto">
            <div className={`flex aspect-[4/5] items-center justify-center rounded-card p-4 text-center font-display text-lg leading-tight italic opacity-80 shadow-card ring-1 ring-line/60 ${s.className}`}>
              {s.name}
            </div>
            <figcaption className="mt-2 text-sm text-ink-3">Coming soon</figcaption>
          </figure>
        ))}
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Which recipe?">
        <ul className="-mx-2 max-h-[55dvh] overflow-y-auto">
          {(recipes ?? []).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setPicking(false)
                  setForRecipe(r)
                }}
                className="flex h-12 w-full items-center justify-between rounded-xl px-2 text-left hover:bg-paper-2"
              >
                <span className="truncate font-medium">{r.name}</span>
                <Icon name="chevronRight" size={18} className="text-ink-3" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
      <NewCardSheet recipe={forRecipe} open={!!forRecipe} onClose={() => setForRecipe(undefined)} />
    </Page>
  )
}

function CardTile({ design, recipe }: { design: Design; recipe?: Recipe }) {
  const url = useBlobUrl(design.thumb)
  return (
    <Link to={`/studio/cards/${design.id}`} className="group block">
      <div className="flex aspect-[4/5] items-center justify-center rounded-card bg-paper-2 p-3 ring-1 ring-line/60">
        {url ? (
          <img src={url} alt="" className="max-h-full max-w-full rounded-md shadow-card transition group-hover:-translate-y-0.5" style={{ aspectRatio: `${design.width} / ${design.height}` }} />
        ) : (
          <Icon name="palette" className="text-ink-3" />
        )}
      </div>
      <p className="mt-2 truncate font-display text-lg leading-snug">{recipe?.name ?? 'Recipe'}</p>
      <p className="truncate text-sm text-ink-3">{design.name}</p>
    </Link>
  )
}
