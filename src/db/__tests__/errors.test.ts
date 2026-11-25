import { afterEach, describe, expect, it, vi } from 'vitest'
import { StorageError, StorageFullError, ValidationError, createRecipe, db, onStorageError } from '@/db'

afterEach(() => vi.restoreAllMocks())

describe('storage errors', () => {
  it('turns a quota failure into StorageFullError and tells listeners', async () => {
    const seen: StorageError[] = []
    const off = onStorageError((e) => seen.push(e))
    const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
    vi.spyOn(db.recipes, 'add').mockRejectedValueOnce(quota)

    await expect(createRecipe({ name: 'x' })).rejects.toBeInstanceOf(StorageFullError)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBeInstanceOf(StorageFullError)
    off()
  })

  it('recognizes quota errors wrapped by Dexie', async () => {
    const wrapped = Object.assign(new Error('abort'), { name: 'AbortError', inner: { name: 'QuotaExceededError' } })
    vi.spyOn(db.recipes, 'add').mockRejectedValueOnce(wrapped)
    await expect(createRecipe({ name: 'x' })).rejects.toBeInstanceOf(StorageFullError)
  })

  it('wraps unknown failures as StorageError and keeps the cause', async () => {
    const boom = new Error('boom')
    vi.spyOn(db.recipes, 'add').mockRejectedValueOnce(boom)
    const err = await createRecipe({ name: 'x' }).catch((e) => e)
    expect(err).toBeInstanceOf(StorageError)
    expect(err).not.toBeInstanceOf(StorageFullError)
    expect(err.cause).toBe(boom)
  })

  it('passes validation errors through without notifying listeners', async () => {
    const listener = vi.fn()
    const off = onStorageError(listener)
    await expect(createRecipe({ name: '' })).rejects.toBeInstanceOf(ValidationError)
    expect(listener).not.toHaveBeenCalled()
    off()
  })
})
