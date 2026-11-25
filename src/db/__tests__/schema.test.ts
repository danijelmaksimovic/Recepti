import { describe, expect, it } from 'vitest'
import { BUILT_IN_CATEGORIES } from '@/domain/categories'
import { RecipeBookDB, SCHEMA_VERSION, builtInCategoryId, db, getMeta, listCategories, setMeta } from '@/db'

describe('schema', () => {
  it('seeds the 10 built-in categories in order on first run', async () => {
    const cats = await listCategories()
    expect(cats.map((c) => c.name)).toEqual([...BUILT_IN_CATEGORIES])
    expect(cats.every((c) => c.builtIn)).toBe(true)
    expect(cats[0].id).toBe(builtInCategoryId('Breakfast'))
  })

  it('records the schema version', async () => {
    expect(await getMeta('schemaVersion')).toBe(SCHEMA_VERSION)
  })

  it('keeps data when the database is reopened', async () => {
    await setMeta('lastBackupAt', 123)
    db.close()
    const reopened = new RecipeBookDB()
    await reopened.open()
    expect((await reopened.meta.get('lastBackupAt'))?.value).toBe(123)
    expect(await reopened.categories.count()).toBe(10)
    reopened.close()
    await db.open()
  })
})
