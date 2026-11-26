import { describe, expect, it } from 'vitest'
import { CARD_DOC_VERSION, DEFAULT_BACKGROUND, emptyDoc, fontsInDoc, migrateDoc, stripResolvedText } from '../doc'
import { starterLayout } from '../layout'
import { PRESETS, clampSide, describeSize, getPreset, presetSize } from '../presets'

describe('card document', () => {
  it('migrates anything to the current version without throwing', () => {
    for (const raw of [undefined, null, 'x', [], {}, { version: '6.0.0', objects: 'nope' }]) {
      const d = migrateDoc(raw)
      expect(d.version).toBe(CARD_DOC_VERSION)
      expect(d.objects).toEqual([])
      expect(d.background).toEqual(DEFAULT_BACKGROUND)
    }
  })

  it('keeps objects from raw Fabric JSON and drops malformed ones', () => {
    const d = migrateDoc({ version: '6.0.0', objects: [{ type: 'Textbox', text: 'hi' }, { text: 'no type' }, null] })
    expect(d.objects).toEqual([{ type: 'Textbox', text: 'hi' }])
  })

  it('cleans background values', () => {
    const d = migrateDoc({ version: 1, background: { color: 'red', texture: 'bogus', textureOpacity: 7, textureScale: -1, textureColor: '#123456' } })
    expect(d.background).toEqual({ ...DEFAULT_BACKGROUND, textureColor: '#123456', textureOpacity: 1, textureScale: 0.5 })
  })

  it('stores tokenized text as its source, never the resolved content', () => {
    const out = stripResolvedText([
      { type: 'Textbox', text: 'Plum cake', sourceText: '{{recipe.name}}', styles: [{ x: 1 }] },
      { type: 'Rect', fill: '#000' },
    ])
    expect(out[0]).toEqual({ type: 'Textbox', text: '{{recipe.name}}', sourceText: '{{recipe.name}}' })
    expect(out[1]).toEqual({ type: 'Rect', fill: '#000' })
  })

  it('lists fonts and weights used', () => {
    const doc = emptyDoc()
    doc.objects = starterLayout(1200, 1800)
    const fonts = fontsInDoc(doc)
    expect(fonts).toContainEqual({ family: 'Fraunces', weight: '600', style: 'normal' })
    expect(fonts).toContainEqual({ family: 'Lora', weight: '400', style: 'italic' })
  })
})

describe('starter layout', () => {
  it.each([
    [1200, 1800],
    [1800, 1200],
    [1080, 1080],
    [2480, 3508],
  ])('places the main fields inside a %i × %i card', (w, h) => {
    const objs = starterLayout(w, h)
    const sources = objs.map((o) => o.sourceText).filter(Boolean).join(' ')
    for (const f of ['name', 'description', 'ingredients', 'steps', 'servings']) expect(sources).toContain(`{{recipe.${f}}}`)
    for (const o of objs) {
      expect(o.left as number).toBeGreaterThan(0)
      expect(o.left as number).toBeLessThan(w)
      expect(o.top as number).toBeGreaterThan(0)
      const bottom = (o.top as number) + ((o.maxHeight as number | undefined) ?? 0) * (o.originY === 'bottom' ? 0 : 1)
      expect(bottom).toBeLessThanOrEqual(h)
    }
  })

  it('uses two columns on landscape cards', () => {
    const objs = starterLayout(1800, 1200)
    const ing = objs.find((o) => o.name === 'Ingredients')!
    const steps = objs.find((o) => o.name === 'Steps')!
    expect(ing.top).toBe(steps.top)
    expect(ing.left as number).toBeLessThan(steps.left as number)
  })
})

describe('presets', () => {
  it('stores print sizes at 300 DPI', () => {
    expect(getPreset('print-4x6')).toMatchObject({ width: 1200, height: 1800 })
    expect(getPreset('page-a4')).toMatchObject({ width: 2480, height: 3508 })
    expect(getPreset('page-letter')).toMatchObject({ width: 2550, height: 3300 })
  })

  it('has unique ids and portrait base sizes', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
    for (const p of PRESETS) expect(p.height).toBeGreaterThanOrEqual(p.width)
  })

  it('flips for landscape', () => {
    const p = getPreset('print-5x7')!
    expect(presetSize(p, 'landscape')).toEqual({ width: 2100, height: 1500 })
    expect(presetSize(p, 'portrait')).toEqual({ width: 1500, height: 2100 })
  })

  it('clamps custom sizes', () => {
    expect(clampSide(10)).toBe(200)
    expect(clampSide(99999)).toBe(4000)
    expect(clampSide(NaN)).toBe(200)
    expect(clampSide(1234.6)).toBe(1235)
  })

  it('describes sizes', () => {
    expect(describeSize('print-4x6', 1800, 1200)).toBe('Recipe card 4×6″ · landscape')
    expect(describeSize('digital-1x1', 1080, 1080)).toBe('Square 1:1')
    expect(describeSize('custom', 900, 700)).toBe('900 × 700 px')
  })
})

describe('images in the document', () => {
  it('stores images by asset id only, and bound frames without any asset id', async () => {
    const { stripResolvedText } = await import('../doc')
    const [fixed, bound] = stripResolvedText([
      { type: 'Image', assetId: 'a1', src: 'blob:http://x/123', crop: { aspect: 1 } },
      { type: 'Image', binding: 'recipe.photo', assetId: 'a2', src: 'blob:http://x/456' },
    ])
    expect(fixed).toEqual({ type: 'Image', assetId: 'a1', src: '', crop: { aspect: 1 } })
    expect(bound).toEqual({ type: 'Image', binding: 'recipe.photo', src: '' })
  })

  it('keeps a valid background image and drops a broken one', async () => {
    const { migrateDoc } = await import('../doc')
    const ok = migrateDoc({ version: 1, background: { image: { assetId: 'bg', fit: 'tile', opacity: 3, tileSize: 0.01 } }, objects: [] })
    expect(ok.background.image).toEqual({ assetId: 'bg', fit: 'tile', opacity: 1, tileSize: 0.05 })
    expect(migrateDoc({ version: 1, background: { image: { fit: 'cover' } }, objects: [] }).background.image).toBeUndefined()
  })
})
