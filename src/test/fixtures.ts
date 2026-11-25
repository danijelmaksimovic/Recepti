import { addAsset, type NewAsset } from '@/db'

let n = 0
/** A tiny asset with unique bytes unless `bytes` is given. */
export async function makeAsset(overrides: Partial<NewAsset> & { bytes?: string } = {}) {
  const { bytes, ...rest } = overrides
  const blob = new Blob([bytes ?? `asset-${++n}-${Math.random()}`], { type: 'image/png' })
  return (await addAsset({ kind: 'photo', blob, width: 10, height: 10, ...rest })).asset
}

/** A minimal Fabric-like canvas JSON that references the given assets. */
export function canvasWith(...assetIds: string[]) {
  return {
    version: '6.0.0',
    objects: assetIds.map((assetId, i) => ({ type: 'image', left: i * 10, assetId })),
  }
}
