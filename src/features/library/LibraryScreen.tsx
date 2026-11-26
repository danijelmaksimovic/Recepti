/**
 * Asset library: every imported drawing, sticker, photo and background, ready
 * to reuse on any card (SPEC §6D). Import by picker, drag-drop or paste.
 */
import { useEffect, useMemo, useState } from 'react'
import { AssetInUseError, deleteAsset, updateAsset } from '@/db'
import type { Asset, AssetKind } from '@/domain/types'
import { AssetGrid, ImportButton, KindChips, progressLabel } from '@/features/assets/AssetGrid'
import { KIND_LABELS, KIND_ORDER, useAssetUsage, useAssets, useImporter } from '@/features/assets/hooks'
import { filesFrom } from '@/features/assets/importer'
import { IMAGE_ACCEPT } from '@/features/assets/sniff'
import { forgetAsset, thumbUrl } from '@/features/assets/urls'
import { Button } from '@/ui/Button'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { cx } from '@/ui/cx'
import { Icon } from '@/ui/Icon'
import { EmptyState, Page } from '@/ui/Page'
import { Sheet } from '@/ui/Sheet'
import { TagInput } from '@/ui/TagInput'
import { toast } from '@/ui/toast'

export function LibraryScreen() {
  const assets = useAssets()
  const usage = useAssetUsage()
  const { run, progress } = useImporter()
  const [kind, setKind] = useState<AssetKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (assets ?? []).filter(
      (a) => (kind === 'all' || a.kind === kind) && (!q || a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q))),
    )
  }, [assets, kind, query])

  const importNow = async (files: File[]) => {
    const out = await run(files)
    if (out?.added === 1 && out.assets.length === 1 && !out.failed.length) toast(`Added to ${KIND_LABELS[out.assets[0].kind].many}.`)
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return
      const files = filesFrom(e.clipboardData)
      if (files.length) {
        e.preventDefault()
        void importNow(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const open = assets?.find((a) => a.id === openId)
  const busy = progressLabel(progress)

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        setDragging(false)
        const files = filesFrom(e.dataTransfer)
        if (!files.length) return
        e.preventDefault()
        void importNow(files)
      }}
      className={cx('min-h-full', dragging && 'outline-2 -outline-offset-8 outline-dashed outline-accent')}
    >
      <Page
        eyebrow="Assets"
        title="Library"
        actions={
          assets?.length ? (
            <ImportButton accept={IMAGE_ACCEPT} onFiles={(f) => void importNow(f)} busy={busy}>
              Import
            </ImportButton>
          ) : undefined
        }
      >
        {assets === undefined ? null : assets.length === 0 ? (
          <EmptyState
            art={
              <span className="flex size-16 items-center justify-center rounded-2xl bg-herb-soft text-herb">
                <Icon name="images" size={30} />
              </span>
            }
            title="Your drawings live here"
            body="Import drawings from your tablet (transparent PNG works best), stickers, icons, photos and backgrounds. Each is stored once and can be reused on any card."
            action={
              <ImportButton accept={IMAGE_ACCEPT} onFiles={(f) => void importNow(f)} busy={busy}>
                Import images
              </ImportButton>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative flex-1 sm:max-w-xs">
                <span className="sr-only">Search assets</span>
                <Icon name="search" size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search names and tags"
                  className="h-11 w-full rounded-full bg-surface pr-4 pl-10 ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
                />
              </label>
              <KindChips assets={assets} value={kind} onChange={setKind} className="-mx-4 px-4 sm:mx-0 sm:px-0" />
            </div>
            {shown.length ? (
              <AssetGrid
                assets={shown}
                onPick={(a) => setOpenId(a.id)}
                badge={(a) =>
                  usage?.[a.id] ? (
                    <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded-full bg-ink/75 px-1.5 py-0.5 text-[11px] font-semibold text-paper tabular-nums" title={`Used ${usage[a.id]}×`}>
                      {usage[a.id]}×
                    </span>
                  ) : null
                }
              />
            ) : (
              <p className="py-10 text-center text-ink-3">Nothing matches.</p>
            )}
            <p className="mt-6 text-center text-xs text-ink-3">Tip: drop files here or paste an image to import it.</p>
          </>
        )}
      </Page>
      {open && <AssetSheet asset={open} usage={usage?.[open.id] ?? 0} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
}

const FORMAT: Record<string, string> = { 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/webp': 'WebP', 'image/svg+xml': 'SVG', 'image/gif': 'GIF' }

function AssetSheet({ asset, usage, onClose }: { asset: Asset; usage: number; onClose: () => void }) {
  const [name, setName] = useState(asset.name)
  const [confirm, setConfirm] = useState(false)
  const [fullUrl, setFullUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(asset.blob)
    setFullUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [asset.blob])

  const save = (patch: Parameters<typeof updateAsset>[1]) =>
    updateAsset(asset.id, patch).catch((e) => toast(e instanceof Error ? e.message : 'Could not save.', { tone: 'error' }))

  const remove = async () => {
    try {
      await deleteAsset(asset.id)
      forgetAsset(asset.id)
      onClose()
      toast('Deleted from your library.')
    } catch (e) {
      toast(e instanceof AssetInUseError ? 'Still used on a card or recipe, so it was kept.' : 'Could not delete.', { tone: 'error' })
    }
  }

  const photo = asset.kind === 'photo' || asset.kind === 'background'
  return (
    <Sheet open onClose={onClose} title={asset.name || KIND_LABELS[asset.kind].one}>
      <div className={cx('mb-4 flex h-56 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-line', !photo && 'checker')}>
        <img src={fullUrl ?? thumbUrl(asset)} alt="" className={cx('max-h-full max-w-full object-contain', !photo && 'p-3')} />
      </div>
      <p className="mb-4 text-sm text-ink-3">
        {[FORMAT[asset.mime] ?? asset.mime, `${asset.width} × ${asset.height}`, formatBytes(asset.bytes)].join(' · ')}
        {' · '}
        {usage ? `Used in ${usage} place${usage === 1 ? '' : 's'}` : 'Not used yet'}
      </p>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-3 uppercase">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== asset.name && void save({ name })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="e.g. Lemon sketch"
            className="h-11 w-full rounded-xl bg-surface px-3 ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-3 uppercase">Kind</span>
          <div role="radiogroup" aria-label="Kind" className="flex flex-wrap gap-1.5">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={asset.kind === k}
                onClick={() => void save({ kind: k })}
                className={cx('h-9 rounded-full px-3.5 text-sm font-medium transition', asset.kind === k ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-2')}
              >
                {KIND_LABELS[k].one}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="asset-tags" className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-3 uppercase">
            Tags
          </label>
          <TagInput id="asset-tags" value={asset.tags} onChange={(tags) => void save({ tags })} />
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-3">{usage ? 'Remove it from every card before deleting.' : ''}</p>
        <Button variant="ghost" icon="trash" className="text-danger" disabled={usage > 0} onClick={() => setConfirm(true)}>
          Delete
        </Button>
      </div>
      <ConfirmSheet
        open={confirm}
        title="Delete this image?"
        body="It will be removed from your library. This can’t be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => void remove()}
        onClose={() => setConfirm(false)}
      />
    </Sheet>
  )
}
