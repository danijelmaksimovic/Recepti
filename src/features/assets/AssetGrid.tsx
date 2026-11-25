/** Thumbnail grid shared by the Library screen and the Studio pickers. */
import { useMemo, useState, type ReactNode } from 'react'
import type { Asset, AssetKind } from '@/domain/types'
import { Chip } from '@/ui/Chip'
import { cx } from '@/ui/cx'
import { Icon } from '@/ui/Icon'
import { KIND_LABELS, KIND_ORDER } from './hooks'
import { thumbUrl } from './urls'

export function AssetThumb({ asset, className, fit = 'contain' }: { asset: Asset; className?: string; fit?: 'contain' | 'cover' }) {
  const photo = asset.kind === 'photo' || asset.kind === 'background'
  return (
    <span className={cx('block overflow-hidden', !photo && 'checker', className)}>
      <img
        src={thumbUrl(asset)}
        alt=""
        draggable={false}
        className={cx('size-full', photo || fit === 'cover' ? 'object-cover' : 'object-contain p-[8%]')}
      />
    </span>
  )
}

export function AssetGrid({
  assets,
  onPick,
  selectedId,
  size = 'md',
  badge,
}: {
  assets: Asset[]
  onPick: (a: Asset) => void
  selectedId?: string
  size?: 'sm' | 'md'
  badge?: (a: Asset) => ReactNode
}) {
  return (
    <ul className={cx('grid gap-2', size === 'sm' ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6')}>
      {assets.map((a) => (
        <li key={a.id} className="relative">
          <button
            type="button"
            onClick={() => onPick(a)}
            aria-label={a.name || KIND_LABELS[a.kind].one}
            aria-pressed={selectedId ? selectedId === a.id : undefined}
            className={cx(
              'block aspect-square w-full overflow-hidden rounded-2xl ring-1 ring-line transition active:scale-[0.97]',
              selectedId === a.id && 'outline-2 outline-offset-2 outline-accent',
            )}
          >
            <AssetThumb asset={a} className="size-full" />
          </button>
          {badge?.(a)}
        </li>
      ))}
    </ul>
  )
}

/** Kind chips with counts; kinds with nothing in them are hidden. */
export function KindChips({
  assets,
  value,
  onChange,
  kinds = KIND_ORDER,
  className,
}: {
  assets: Asset[]
  value: AssetKind | 'all'
  onChange: (k: AssetKind | 'all') => void
  kinds?: AssetKind[]
  className?: string
}) {
  const counts = useMemo(() => {
    const c: Partial<Record<AssetKind, number>> = {}
    for (const a of assets) c[a.kind] = (c[a.kind] ?? 0) + 1
    return c
  }, [assets])
  const shown = kinds.filter((k) => counts[k] || value === k)
  if (shown.length < 2 && value === 'all') return null
  return (
    <div className={cx('no-scrollbar flex gap-2 overflow-x-auto', className)}>
      <Chip selected={value === 'all'} onClick={() => onChange('all')}>
        All
      </Chip>
      {shown.map((k) => (
        <Chip key={k} selected={value === k} onClick={() => onChange(k)}>
          {KIND_LABELS[k].many} <span className="ml-0.5 opacity-60">{counts[k] ?? 0}</span>
        </Chip>
      ))}
    </div>
  )
}

/** Hidden file input behind a button. */
export function ImportButton({
  accept,
  onFiles,
  children,
  className,
  busy,
}: {
  accept: string
  onFiles: (files: File[]) => void
  children: ReactNode
  className?: string
  busy?: string | null
}) {
  const [key, setKey] = useState(0)
  return (
    <label
      className={cx(
        'relative inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-4 text-[15px] font-medium text-accent-ink transition select-none focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent hover:brightness-105',
        busy && 'pointer-events-none opacity-70',
        className,
      )}
    >
      <Icon name="upload" size={20} />
      {busy ?? children}
      <input
        key={key}
        type="file"
        multiple
        accept={accept}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          setKey((k) => k + 1)
          if (files.length) onFiles(files)
        }}
      />
    </label>
  )
}

export function progressLabel(p: { done: number; total: number } | null): string | null {
  if (!p) return null
  return p.total > 1 ? `Importing ${Math.min(p.done + 1, p.total)} of ${p.total}…` : 'Importing…'
}
