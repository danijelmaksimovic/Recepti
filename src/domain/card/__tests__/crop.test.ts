import { describe, expect, it } from 'vitest'
import { cleanCrop, cropRect, shapeOf } from '../crop'

describe('crop', () => {
  it('shows the whole image by default', () => {
    expect(cropRect(4000, 3000, { aspect: null, zoom: 1, fx: 0.5, fy: 0.5 })).toEqual({ x: 0, y: 0, width: 4000, height: 3000 })
  })

  it('takes the largest centred square, then zooms and pans inside the image', () => {
    expect(cropRect(4000, 3000, { aspect: 1, zoom: 1, fx: 0.5, fy: 0.5 })).toEqual({ x: 500, y: 0, width: 3000, height: 3000 })
    expect(cropRect(4000, 3000, { aspect: 1, zoom: 2, fx: 0, fy: 1 })).toEqual({ x: 0, y: 1500, width: 1500, height: 1500 })
    const tall = cropRect(1000, 2000, { aspect: 16 / 9, zoom: 1, fx: 0.5, fy: 0.5 })
    expect(tall.width).toBe(1000)
    expect(tall.height).toBeCloseTo(562.5)
    expect(tall.y).toBeCloseTo(718.75)
  })

  it('works the same for any photo size, so a bound frame survives a new photo', () => {
    const spec = { aspect: 4 / 5, zoom: 1.5, fx: 0.3, fy: 0.5 }
    const a = cropRect(1200, 900, spec)
    const b = cropRect(2400, 1800, spec)
    expect(b.width / a.width).toBeCloseTo(2)
    expect(b.x / a.x).toBeCloseTo(2)
    expect(a.width / a.height).toBeCloseTo(0.8)
  })

  it('cleans stored values', () => {
    expect(cleanCrop({ aspect: -1, zoom: 99, fx: 2, fy: 'x' })).toEqual({ aspect: null, zoom: 4, fx: 1, fy: 0.5 })
    expect(cleanCrop(undefined)).toEqual({ aspect: null, zoom: 1, fx: 0.5, fy: 0.5 })
  })

  it('recognises preset shapes', () => {
    expect(shapeOf({ aspect: 1, zoom: 1, fx: 0.5, fy: 0.5 }, 0.5)).toBe('circle')
    expect(shapeOf({ aspect: 1, zoom: 1, fx: 0.5, fy: 0.5 }, 0.1)).toBe('square')
    expect(shapeOf({ aspect: null, zoom: 1, fx: 0.5, fy: 0.5 }, 0)).toBe('original')
    expect(shapeOf({ aspect: 0.7, zoom: 1, fx: 0.5, fy: 0.5 }, 0)).toBeUndefined()
  })
})
