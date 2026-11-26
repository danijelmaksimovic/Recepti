import { useCallback, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { assetUsageCounts, listAssets } from '@/db'
import type { AssetKind } from '@/domain/types'
import { toast } from '@/ui/toast'
import { describeImport, importFiles, type ImportOutcome } from './importer'

export function useAssets() {
  return useLiveQuery(() => listAssets(), [])
}

export function useAssetUsage() {
  return useLiveQuery(assetUsageCounts, [])
}

/** Import with progress and a summary toast. */
export function useImporter() {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const busy = useRef(false)
  const run = useCallback(async (files: File[], kind?: AssetKind): Promise<ImportOutcome | undefined> => {
    if (!files.length || busy.current) return undefined
    busy.current = true
    setProgress({ done: 0, total: files.length })
    try {
      const out = await importFiles(files, { kind, onProgress: (done, total) => setProgress({ done, total }) })
      const tone = out.failed.length && !out.assets.length ? 'error' : undefined
      if (out.failed.length || out.reused || files.length > 1) toast(describeImport(out), { tone, ms: out.failed.length ? 7000 : undefined })
      return out
    } finally {
      busy.current = false
      setProgress(null)
    }
  }, [])
  return { run, progress }
}

export const KIND_LABELS: Record<AssetKind, { one: string; many: string }> = {
  photo: { one: 'Photo', many: 'Photos' },
  illustration: { one: 'Illustration', many: 'Illustrations' },
  sticker: { one: 'Sticker', many: 'Stickers' },
  drawing: { one: 'Drawing', many: 'Drawings' },
  background: { one: 'Background', many: 'Backgrounds' },
  texture: { one: 'Texture', many: 'Textures' },
}

export const KIND_ORDER: AssetKind[] = ['illustration', 'sticker', 'drawing', 'photo', 'background', 'texture']

/** Graphics are placed small; photos and backgrounds large. */
export const isGraphicKind = (k: AssetKind) => k !== 'photo' && k !== 'background'
