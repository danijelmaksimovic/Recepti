import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAsset, listCategories, listCollections } from '@/db'
import type { Category, Collection, Id } from '@/domain/types'

/** Object URL for an asset's thumbnail (or full image), revoked when no longer needed. */
export function useAssetUrl(assetId: Id | undefined, variant: 'thumb' | 'full' = 'thumb'): string | undefined {
  const asset = useLiveQuery(() => (assetId ? getAsset(assetId) : undefined), [assetId])
  const blob = asset ? (variant === 'thumb' ? (asset.thumb ?? asset.blob) : asset.blob) : undefined
  return useBlobUrl(blob)
}

export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function useCategories(): { list: Category[] | undefined; byId: Map<Id, Category> } {
  const list = useLiveQuery(listCategories, [])
  const byId = useMemo(() => new Map((list ?? []).map((c) => [c.id, c])), [list])
  return { list, byId }
}

export function useCollections(): Collection[] | undefined {
  return useLiveQuery(listCollections, [])
}

/** A value kept in localStorage; falls back silently when storage is unavailable. */
export function useStoredState<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key) as T | null
      return v && allowed.includes(v) ? v : fallback
    } catch {
      return fallback
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, v)
    } catch {
      /* private mode */
    }
  }
  return [value, set]
}
