/** Studio panels for photos, library images and image framing. */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAsset } from '@/db'
import { FRAME_SHAPES, MAX_CROP_ZOOM, shapeOf } from '@/domain/card/crop'
import type { BackgroundFit, CardBackground } from '@/domain/card/doc'
import type { Asset, AssetKind, Recipe } from '@/domain/types'
import { AssetGrid, AssetThumb, ImportButton, KindChips, progressLabel } from '@/features/assets/AssetGrid'
import { KIND_ORDER, isGraphicKind, useAssets, useImporter } from '@/features/assets/hooks'
import { IMAGE_ACCEPT, PHOTO_ACCEPT } from '@/features/assets/sniff'
import { Button } from '@/ui/Button'
import { cx } from '@/ui/cx'
import { Icon } from '@/ui/Icon'
import { toast } from '@/ui/toast'
import { useEditor } from './context'
import { Field, Seg, Slider } from './controls'
import type { CardEditor, ImageSnapshot } from './fabric/engine'
import { RECIPE_PHOTO } from './fabric/images'

function place(editor: CardEditor | null, a: Asset) {
  return editor?.addImage({ assetId: a.id, name: a.name || undefined, graphic: isGraphicKind(a.kind) })
}

// ---- Photos tool ---------------------------------------------------------------

export function PhotosPanel({ recipe, onDone }: { recipe: Recipe; onDone?: () => void }) {
  const { editor } = useEditor()
  const all = useAssets()
  const { run, progress } = useImporter()
  const recipePhotos = useLiveQuery(async () => (await Promise.all(recipe.photoAssetIds.map((id) => getAsset(id)))).filter((a): a is Asset => !!a), [recipe.photoAssetIds.join()])
  const main = recipePhotos?.find((p) => p.id === (recipe.photoAssetId ?? recipe.photoAssetIds[0]))
  const library = useMemo(() => (all ?? []).filter((a) => a.kind === 'photo' && !recipe.photoAssetIds.includes(a.id)), [all, recipe.photoAssetIds])

  const done = () => onDone?.()
  const upload = async (files: File[]) => {
    const out = await run(files, 'photo')
    if (!out?.assets.length) return
    for (const a of out.assets) await place(editor, a)
    done()
  }

  return (
    <div className="space-y-5">
      <Field label="Recipe photo">
        <button
          type="button"
          onClick={async () => {
            await editor?.addImage({ binding: RECIPE_PHOTO })
            done()
          }}
          className="flex w-full items-center gap-3 rounded-2xl bg-paper-2 p-2 pr-3 text-left transition hover:bg-line/60"
        >
          {main ? (
            <AssetThumb asset={main} fit="cover" className="size-16 shrink-0 rounded-xl" />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-line/70 text-ink-3">
              <Icon name="camera" size={24} />
            </span>
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[15px] font-medium">
              <Icon name="link" size={16} className="text-accent" /> Add recipe photo
            </span>
            <span className="mt-0.5 block text-xs text-ink-3">
              {main ? 'Follows the recipe: change its photo and the card updates.' : 'This recipe has no photo yet. The frame shows a placeholder until it gets one.'}
            </span>
          </span>
        </button>
      </Field>

      {!!recipePhotos && recipePhotos.length > 1 && (
        <Field label="This recipe’s photos">
          <AssetGrid size="sm" assets={recipePhotos} onPick={async (a) => (await place(editor, a), done())} />
        </Field>
      )}

      <ImportButton accept={PHOTO_ACCEPT} onFiles={(f) => void upload(f)} busy={progressLabel(progress)} className="w-full">
        Upload photos
      </ImportButton>

      {library.length > 0 && (
        <Field label="From your library">
          <AssetGrid size="sm" assets={library} onPick={async (a) => (await place(editor, a), done())} />
        </Field>
      )}
    </div>
  )
}

// ---- Images tool (library) --------------------------------------------------------

const GRAPHIC_KINDS: AssetKind[] = ['illustration', 'sticker', 'drawing', 'photo', 'background', 'texture']

export function ImagesPanel({ onDone }: { onDone?: () => void }) {
  const { editor } = useEditor()
  const all = useAssets()
  const { run, progress } = useImporter()
  const [kind, setKind] = useState<AssetKind | 'all'>('all')
  const shown = useMemo(() => (all ?? []).filter((a) => kind === 'all' || a.kind === kind), [all, kind])

  const upload = async (files: File[]) => {
    const out = await run(files)
    if (!out?.assets.length) return
    for (const a of out.assets) await place(editor, a)
    onDone?.()
  }

  return (
    <div className="space-y-4">
      <ImportButton accept={IMAGE_ACCEPT} onFiles={(f) => void upload(f)} busy={progressLabel(progress)} className="w-full">
        Import drawings or images
      </ImportButton>
      <p className="text-xs text-ink-3">PNG with transparency, JPG, WebP or SVG. Everything you import is kept in your Library for other cards.</p>
      {all && all.length > 0 && (
        <>
          <KindChips assets={all} value={kind} onChange={setKind} kinds={GRAPHIC_KINDS} className="-mx-4 px-4" />
          <AssetGrid
            size="sm"
            assets={shown}
            onPick={async (a) => {
              await place(editor, a)
              onDone?.()
            }}
          />
        </>
      )}
    </div>
  )
}

// ---- selected image ------------------------------------------------------------------

export function ImageFramePanel({ sel }: { sel: ImageSnapshot }) {
  const { editor } = useEditor()
  const shape = shapeOf(sel.crop, sel.radius)
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <div className="space-y-4">
      <Field label="Shape">
        <div className="grid grid-cols-3 gap-1.5">
          {FRAME_SHAPES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={shape === f.id}
              onClick={() => editor?.setImageFrame({ aspect: f.aspect }, f.radius ?? (sel.radius >= 0.49 ? 0 : sel.radius))}
              className={cx('flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition', shape === f.id ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-2')}
            >
              <FrameIcon aspect={f.aspect} round={!!f.radius} />
              {f.label}
            </button>
          ))}
        </div>
      </Field>
      <Slider label="Corners" value={Math.round(sel.radius * 200)} min={0} max={100} onChange={(v) => editor?.setImageFrame({}, v / 200)} format={(v) => `${v}%`} />
      <Slider label="Zoom" value={sel.crop.zoom} min={1} max={MAX_CROP_ZOOM} step={0.05} onChange={(zoom) => editor?.setImageFrame({ zoom })} format={(v) => `${v.toFixed(2)}×`} />
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Left – right" value={sel.crop.fx} min={0} max={1} step={0.01} onChange={(fx) => editor?.setImageFrame({ fx })} format={pct} />
        <Slider label="Top – bottom" value={sel.crop.fy} min={0} max={1} step={0.01} onChange={(fy) => editor?.setImageFrame({ fy })} format={pct} />
      </div>
      {sel.bound ? (
        <p className="flex items-start gap-1.5 text-sm text-ink-3">
          <Icon name="link" size={16} className="mt-0.5 shrink-0 text-accent" /> Shows the recipe’s main photo. The crop is kept when the photo changes.
        </p>
      ) : (
        <Button
          variant="secondary"
          icon="images"
          className="w-full"
          onClick={() => {
            if (editor?.imageToBackground()) toast('Now the card background. Adjust it under Background.')
          }}
        >
          Use as background
        </Button>
      )}
    </div>
  )
}

function FrameIcon({ aspect, round }: { aspect: number | null; round: boolean }) {
  const a = aspect ?? 1.25
  const w = a >= 1 ? 16 : 16 * a
  const h = a >= 1 ? 16 / a : 16
  return (
    <span className="flex size-4 items-center justify-center" aria-hidden>
      <span className={cx('block border-[1.5px] border-current', round ? 'rounded-full' : aspect === null ? 'rounded-[3px] border-dashed' : 'rounded-[3px]')} style={{ width: w, height: h }} />
    </span>
  )
}

// ---- background image ------------------------------------------------------------------

const FITS: { value: BackgroundFit; label: string }[] = [
  { value: 'cover', label: 'Fill' },
  { value: 'contain', label: 'Fit' },
  { value: 'tile', label: 'Tile' },
]

export function BackgroundImageSection({ bg, update }: { bg: CardBackground; update: (patch: Partial<CardBackground>) => void }) {
  const all = useAssets()
  const { run, progress } = useImporter()
  const [picking, setPicking] = useState(false)
  const [kind, setKind] = useState<AssetKind | 'all'>('all')
  const current = all?.find((a) => a.id === bg.image?.assetId)
  const image = bg.image
  const choose = (a: Asset) => {
    update({ image: { assetId: a.id, fit: image?.fit ?? (a.kind === 'texture' ? 'tile' : 'cover'), opacity: image?.opacity ?? 1, tileSize: image?.tileSize ?? 0.25 } })
    setPicking(false)
  }
  const sorted = useMemo(() => {
    const order = (k: AssetKind) => ['background', 'photo', 'texture'].indexOf(k) + 1 || 9
    return [...(all ?? [])].sort((a, b) => order(a.kind) - order(b.kind)).filter((a) => kind === 'all' || a.kind === kind)
  }, [all, kind])

  return (
    <Field label="Image">
      {image && !picking ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {current ? (
              <AssetThumb asset={current} fit="cover" className="size-16 shrink-0 rounded-xl ring-1 ring-line" />
            ) : (
              <span className="size-16 shrink-0 rounded-xl bg-paper-2" />
            )}
            <div className="flex flex-1 flex-wrap gap-2">
              <Button variant="secondary" className="h-9 px-3 text-sm" onClick={() => setPicking(true)}>
                Change
              </Button>
              <Button variant="ghost" className="h-9 px-3 text-sm" onClick={() => update({ image: undefined })}>
                Remove
              </Button>
            </div>
          </div>
          <Seg label="Image fit" value={image.fit} options={FITS} onChange={(fit) => update({ image: { ...image, fit } })} />
          <Slider label="Image strength" value={Math.round(image.opacity * 100)} min={5} max={100} onChange={(v) => update({ image: { ...image, opacity: v / 100 } })} format={(v) => `${v}%`} />
          {image.fit === 'tile' && (
            <Slider label="Tile size" value={Math.round(image.tileSize * 100)} min={5} max={100} onChange={(v) => update({ image: { ...image, tileSize: v / 100 } })} format={(v) => `${v}%`} />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <ImportButton accept={IMAGE_ACCEPT} busy={progressLabel(progress)} className="w-full" onFiles={async (f) => {
            const out = await run(f, 'background')
            if (out?.assets[0]) choose(out.assets[0])
          }}>
            Upload a background
          </ImportButton>
          {all && all.length > 0 && (
            <>
              <KindChips assets={all} value={kind} onChange={setKind} kinds={['background', 'photo', 'texture', ...KIND_ORDER.filter((k) => !['background', 'photo', 'texture'].includes(k))]} className="-mx-4 px-4" />
              <AssetGrid size="sm" assets={sorted} onPick={choose} selectedId={image?.assetId} />
            </>
          )}
          {picking && (
            <Button variant="ghost" className="w-full" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </Field>
  )
}
