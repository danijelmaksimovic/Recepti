import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { deleteDesign, duplicateDesign, listDesigns, saveDesign, setPrimaryDesign } from '@/db'
import { describeSize, getPreset, orientationOf } from '@/domain/card/presets'
import type { Design, Recipe } from '@/domain/types'
import { useBlobUrl } from '@/features/recipes/hooks'
import { Button } from '@/ui/Button'
import { ConfirmSheet, SheetAction } from '@/ui/ConfirmSheet'
import { Icon } from '@/ui/Icon'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { NewCardSheet } from './NewCardSheet'

/** A recipe's card designs: open, create, and manage (rename, duplicate, main card, delete). */
export function DesignsStrip({ recipe }: { recipe: Recipe }) {
  const navigate = useNavigate()
  const designs = useLiveQuery(() => listDesigns(recipe.id), [recipe.id])
  const [creating, setCreating] = useState(false)
  const [menuFor, setMenuFor] = useState<Design>()
  const [renaming, setRenaming] = useState<Design>()
  const [confirmDelete, setConfirmDelete] = useState<Design>()

  const sorted = (designs ?? []).slice().sort((a, b) => Number(b.id === recipe.primaryDesignId) - Number(a.id === recipe.primaryDesignId))

  return (
    <>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {sorted.map((d) => (
          <DesignThumb
            key={d.id}
            design={d}
            primary={d.id === recipe.primaryDesignId && sorted.length > 1}
            onOpen={() => navigate(`/studio/cards/${d.id}`)}
            onMenu={() => setMenuFor(d)}
          />
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-44 w-32 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-ink-2 transition hover:bg-surface"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="plus" />
          </span>
          <span className="text-sm font-medium">New card</span>
        </button>
      </div>

      <NewCardSheet recipe={recipe} open={creating} onClose={() => setCreating(false)} />

      <Sheet open={!!menuFor} onClose={() => setMenuFor(undefined)} title={menuFor?.name ?? 'Card'}>
        {menuFor && (
          <>
            <SheetAction icon={<Icon name="palette" />} label="Open in Studio" onClick={() => navigate(`/studio/cards/${menuFor.id}`)} />
            {menuFor.id !== recipe.primaryDesignId && (
              <SheetAction
                icon={<Icon name="heart" />}
                label="Make main card"
                onClick={async () => {
                  setMenuFor(undefined)
                  await setPrimaryDesign(recipe.id, menuFor.id)
                  toast('Main card updated')
                }}
              />
            )}
            <SheetAction
              icon={<Icon name="pen" />}
              label="Rename"
              onClick={() => {
                setRenaming(menuFor)
                setMenuFor(undefined)
              }}
            />
            <SheetAction
              icon={<Icon name="copy" />}
              label="Duplicate"
              onClick={async () => {
                setMenuFor(undefined)
                await duplicateDesign(menuFor.id)
                toast('Card duplicated')
              }}
            />
            <SheetAction
              danger
              icon={<Icon name="trash" />}
              label="Delete"
              onClick={() => {
                setConfirmDelete(menuFor)
                setMenuFor(undefined)
              }}
            />
          </>
        )}
      </Sheet>

      <RenameDesignSheet design={renaming} onClose={() => setRenaming(undefined)} />

      <ConfirmSheet
        open={!!confirmDelete}
        title="Delete this card?"
        body={`“${confirmDelete?.name}” will be removed. The recipe and its photos stay.`}
        confirmLabel="Delete card"
        danger
        onClose={() => setConfirmDelete(undefined)}
        onConfirm={async () => {
          if (confirmDelete) await deleteDesign(confirmDelete.id)
          setConfirmDelete(undefined)
          toast('Card deleted')
        }}
      />
    </>
  )
}

function DesignThumb({ design, primary, onOpen, onMenu }: { design: Design; primary: boolean; onOpen: () => void; onMenu: () => void }) {
  const url = useBlobUrl(design.thumb)
  const landscape = design.width > design.height
  return (
    <figure className="relative shrink-0 snap-start">
      <button type="button" onClick={onOpen} aria-label={`Open ${design.name}`} className="block">
        <span
          className="flex items-center justify-center overflow-hidden rounded-2xl bg-paper-2 shadow-card ring-1 ring-line/60"
          style={{ aspectRatio: `${design.width} / ${design.height}`, height: landscape ? undefined : '11rem', width: landscape ? '15rem' : undefined }}
        >
          {url ? <img src={url} alt="" className="size-full object-cover" /> : <Icon name="palette" className="text-ink-3" />}
        </span>
      </button>
      <figcaption className="mt-1.5 flex w-0 min-w-full items-start justify-between gap-1">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {design.name}
            {primary && <span className="ml-1.5 rounded-full bg-herb-soft px-1.5 py-0.5 text-[10px] font-semibold text-herb uppercase">Main</span>}
          </span>
          <span className="block truncate text-xs text-ink-3">
            {design.name === getPreset(design.preset)?.label ? orientationOf(design.width, design.height) : describeSize(design.preset, design.width, design.height)}
          </span>
        </span>
        <button type="button" onClick={onMenu} aria-label={`More for ${design.name}`} className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-paper-2">
          <Icon name="more" size={20} />
        </button>
      </figcaption>
    </figure>
  )
}

function RenameDesignSheet({ design, onClose }: { design?: Design; onClose: () => void }) {
  const [name, setName] = useState('')
  const [lastId, setLastId] = useState<string>()
  if (design && design.id !== lastId) {
    setLastId(design.id)
    setName(design.name)
  }
  return (
    <Sheet open={!!design} onClose={onClose} title="Rename card">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (design && name.trim()) await saveDesign(design.id, { name })
          onClose()
        }}
      >
        <input
          aria-label="Card name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 w-full rounded-xl bg-paper-2 px-3 outline-none focus:ring-2 focus:ring-accent"
        />
        <Button type="submit" className="mt-4 w-full" disabled={!name.trim()}>
          Save
        </Button>
      </form>
    </Sheet>
  )
}
