/**
 * Import picked, dropped or pasted files into the asset library. Files are
 * processed one at a time to stay within iPhone memory limits, and identical
 * files are stored once (SHA-256, BLUEPRINT §3).
 */
import { addAsset } from '@/db'
import type { Asset, AssetKind } from '@/domain/types'
import { processImage } from './processClient'
import { HEIC_MESSAGE, MAX_FILE_BYTES, detectFormat, type RasterMode } from './sniff'
import { sanitizeSvg, svgThumb } from './svg'

export interface ImportOptions {
  /** Store as this kind; otherwise photos vs. illustrations are told apart automatically. */
  kind?: AssetKind
  onProgress?: (done: number, total: number) => void
}

export interface ImportFailure {
  name: string
  reason: string
}

export interface ImportOutcome {
  /** Every imported asset in file order, including reused ones. */
  assets: Asset[]
  added: number
  reused: number
  failed: ImportFailure[]
}

const THUMB_SIDE = 512

function baseName(name: string) {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim()
}

function modeFor(kind: AssetKind | undefined): RasterMode | 'auto' {
  if (!kind) return 'auto'
  return kind === 'photo' || kind === 'background' ? 'photo' : 'graphic'
}

export async function importOne(file: File, kind?: AssetKind) {
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is too large (over 60 MB).')
  const format = await detectFormat(file)
  if (format === 'heic') throw new Error(HEIC_MESSAGE)
  if (format === 'unknown') throw new Error('Not an image this app can use. Use PNG, JPG, WebP or SVG.')
  const name = baseName(file.name || '')

  if (format === 'svg') {
    const svg = sanitizeSvg(await file.text())
    const blob = new Blob([svg.text], { type: 'image/svg+xml' })
    const thumb = await svgThumb(blob, svg.width, svg.height, THUMB_SIDE)
    return addAsset({ kind: kind ?? 'illustration', blob, thumb, width: svg.width, height: svg.height, name, mime: 'image/svg+xml' })
  }

  const r = await processImage({ file, format, mode: modeFor(kind), thumbSide: THUMB_SIDE })
  const mime = r.blob === file ? file.type || `image/${format}` : r.blob.type
  return addAsset({ kind: kind ?? (r.mode === 'photo' ? 'photo' : 'illustration'), blob: r.blob, thumb: r.thumb, width: r.width, height: r.height, name, mime })
}

export async function importFiles(files: Iterable<File>, opts: ImportOptions = {}): Promise<ImportOutcome> {
  const list = [...files]
  const out: ImportOutcome = { assets: [], added: 0, reused: 0, failed: [] }
  for (const [i, file] of list.entries()) {
    try {
      const { asset, deduplicated } = await importOne(file, opts.kind)
      out.assets.push(asset)
      if (deduplicated) out.reused++
      else out.added++
    } catch (e) {
      out.failed.push({ name: file.name || 'Pasted image', reason: e instanceof Error ? e.message : String(e) })
    }
    opts.onProgress?.(i + 1, list.length)
  }
  return out
}

/** One short sentence for a toast. */
export function describeImport(o: ImportOutcome): string {
  const parts: string[] = []
  if (o.added) parts.push(`${o.added} added`)
  if (o.reused) parts.push(o.reused === 1 ? '1 was already in your library' : `${o.reused} were already in your library`)
  if (o.failed.length) parts.push(o.failed.length === 1 ? `1 couldn’t be imported: ${o.failed[0].reason}` : `${o.failed.length} couldn’t be imported`)
  return parts.length ? parts.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.' : 'Nothing to import.'
}

/** Image files from a drop or paste. */
export function filesFrom(data: DataTransfer | null): File[] {
  if (!data) return []
  return [...data.files].filter((f) => f.type.startsWith('image/') || /\.(svg|png|jpe?g|webp|gif|heic)$/i.test(f.name))
}
