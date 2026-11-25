import { describe, expect, it } from 'vitest'
import { chooseMode, detectFormat, fitWithin, formatFromName, sniffBytes } from '../sniff'

const bytes = (...b: (number | string)[]) => new Uint8Array(b.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])))

describe('file sniffing', () => {
  it('recognises formats by their first bytes', () => {
    expect(sniffBytes(bytes(0x89, 'PNG\r\n', 0x1a, '\n'))).toBe('png')
    expect(sniffBytes(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg')
    expect(sniffBytes(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('webp')
    expect(sniffBytes(bytes(0, 0, 0, 24, 'ftypheic'))).toBe('heic')
    expect(sniffBytes(bytes('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">'))).toBe('svg')
    expect(sniffBytes(bytes('  <svg viewBox="0 0 1 1">'))).toBe('svg')
    expect(sniffBytes(bytes('hello'))).toBe('unknown')
  })

  it('trusts the bytes over a wrong name, and the name when bytes say nothing', async () => {
    const png = new File([bytes(0x89, 'PNG\r\n', 0x1a, '\n', 0, 0)], 'drawing.jpg', { type: 'image/jpeg' })
    expect(await detectFormat(png)).toBe('png')
    expect(formatFromName('', 'IMG_0001.HEIC')).toBe('heic')
    expect(formatFromName('', 'leaf.svg')).toBe('svg')
  })

  it('keeps transparent images as graphics and treats large opaque ones as photos', () => {
    expect(chooseMode('png', true, 6000, 4000)).toBe('graphic')
    expect(chooseMode('jpeg', false, 800, 600)).toBe('photo')
    expect(chooseMode('png', false, 900, 900)).toBe('graphic')
    expect(chooseMode('png', false, 4000, 3000)).toBe('photo')
  })

  it('downscales only when needed', () => {
    expect(fitWithin(4032, 3024, 2560)).toEqual({ width: 2560, height: 1920, scaled: true })
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600, scaled: false })
  })
})
