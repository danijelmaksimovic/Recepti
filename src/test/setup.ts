// In-memory IndexedDB so Dexie runs under Node.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach } from 'vitest'
import { db } from '@/db'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(() => {
  db.close()
})
