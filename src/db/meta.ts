import type { Timestamp } from '@/domain/types'
import { db } from './schema'
import { guardWrite } from './errors'

/** Known meta keys and their value types. */
export interface MetaValues {
  schemaVersion: number
  lastBackupAt: Timestamp
}

export async function getMeta<K extends keyof MetaValues>(key: K): Promise<MetaValues[K] | undefined> {
  return (await db.meta.get(key))?.value as MetaValues[K] | undefined
}

export async function setMeta<K extends keyof MetaValues>(key: K, value: MetaValues[K]): Promise<void> {
  await guardWrite(() => db.meta.put({ key, value }))
}
