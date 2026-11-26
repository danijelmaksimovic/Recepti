import { describe, expect, it, vi } from 'vitest'
import { listAssets } from '@/db'

vi.mock('../processClient', () => ({
  processImage: vi.fn(async ({ file, format }: { file: Blob; format: string }) => {
    const alpha = format === 'png'
    return { blob: alpha ? file : new Blob(['jpeg:', file], { type: 'image/jpeg' }), thumb: new Blob(['t']), width: 640, height: 480, hasAlpha: alpha, mode: alpha ? 'graphic' : 'photo' }
  }),
}))

const { describeImport, importFiles } = await import('../importer')

const png = (name: string, extra = '') => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), extra], name, { type: 'image/png' })
const jpg = (name: string) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], name, { type: 'image/jpeg' })

describe('importing files', () => {
  it('stores drawings as illustrations with their original bytes, photos as photos', async () => {
    const out = await importFiles([png('lemon_sketch.png'), jpg('IMG_2041.jpg')])
    expect(out.added).toBe(2)
    const [drawing, photo] = out.assets
    expect(drawing.kind).toBe('illustration')
    expect(drawing.name).toBe('lemon sketch')
    expect(drawing.mime).toBe('image/png')
    expect(photo.kind).toBe('photo')
    expect(photo.mime).toBe('image/jpeg')
  })

  it('stores identical files once', async () => {
    const out = await importFiles([png('a.png', 'same'), png('copy of a.png', 'same')])
    expect(out).toMatchObject({ added: 1, reused: 1 })
    expect(out.assets[0].id).toBe(out.assets[1].id)
    expect(await listAssets()).toHaveLength(1)
    expect(describeImport(out)).toBe('1 added, 1 was already in your library.')
  })

  it('uses the requested kind', async () => {
    const out = await importFiles([png('paper.png')], { kind: 'texture' })
    expect(out.assets[0].kind).toBe('texture')
  })

  it('explains HEIC and unknown files instead of failing silently', async () => {
    const heic = new File([new Uint8Array([0, 0, 0, 24, ...'ftypheic'.split('').map((c) => c.charCodeAt(0))])], 'IMG_1.HEIC')
    const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const out = await importFiles([heic, txt, png('ok.png')])
    expect(out.added).toBe(1)
    expect(out.failed.map((f) => f.name)).toEqual(['IMG_1.HEIC', 'notes.txt'])
    expect(out.failed[0].reason).toMatch(/HEIC/)
    expect(out.failed[1].reason).toMatch(/PNG, JPG, WebP or SVG/)
  })
})
