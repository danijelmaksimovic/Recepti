import { describe, expect, it } from 'vitest'
import { classifyPointer, type FingerMode } from '../input'
import { addPoint, cleanSketch, emptySketch, inkBounds, outlinePath, shapePressure, strokeOutline, type Stroke } from '../model'

const stroke = (over: Partial<Stroke> = {}): Stroke => ({ tool: 'pen', color: '#2b221b', size: 10, points: [], pressure: true, ...over })

describe('sketch strokes', () => {
  it('stores rounded points and skips exact repeats', () => {
    const s = stroke()
    addPoint(s, 10.04, 20.06, 0.333)
    addPoint(s, 10.04, 20.06, 0.5)
    addPoint(s, 12, 22, 0.4)
    expect(s.points).toEqual([10, 20.1, 0.5, 12, 22, 0.4])
  })
  it('builds a closed outline around the points', () => {
    const s = stroke()
    for (let i = 0; i <= 20; i++) addPoint(s, 100 + i * 10, 100, 0.6)
    const o = strokeOutline(s)
    expect(o.length).toBeGreaterThan(10)
    const xs = o.map((p) => p[0])
    expect(Math.min(...xs)).toBeLessThan(100)
    expect(Math.max(...xs)).toBeGreaterThan(300)
    expect(outlinePath(o)).toMatch(/^M.*Z$/)
  })
  it('lifts very light pen pressure so lines stay visible', () => {
    expect(shapePressure(0)).toBeGreaterThan(0.1)
    expect(shapePressure(1)).toBeCloseTo(1)
    expect(shapePressure(0.5)).toBeGreaterThan(shapePressure(0.2))
  })
})

describe('inkBounds', () => {
  it('covers drawn strokes, ignores eraser strokes and stays on the artboard', () => {
    const d = emptySketch(1000, 1000)
    expect(inkBounds(d)).toBeNull()
    const a = stroke()
    for (let i = 0; i <= 10; i++) addPoint(a, 200 + i * 10, 300, 0.5)
    const e = stroke({ tool: 'eraser', size: 80 })
    addPoint(e, 900, 900, 0.5)
    addPoint(e, 990, 990, 0.5)
    d.strokes = [a, e]
    const b = inkBounds(d)!
    expect(b.x).toBeLessThan(200)
    expect(b.x + b.w).toBeGreaterThan(300)
    expect(b.x + b.w).toBeLessThan(400)
    const edge = stroke()
    addPoint(edge, 2, 2, 0.5)
    addPoint(edge, 5, 5, 0.5)
    d.strokes = [edge]
    expect(inkBounds(d)!.x).toBe(0)
  })
})

describe('cleanSketch', () => {
  it('rejects junk and repairs bad strokes', () => {
    expect(cleanSketch(null)).toBeNull()
    expect(cleanSketch({ width: -1, height: 5, strokes: [] })).toBeNull()
    const d = cleanSketch({
      width: 800,
      height: 600,
      strokes: [
        { tool: 'pen', color: 'red', size: 5, points: [1, 2, 0.5], pressure: 1 },
        { tool: 'laser', points: [1, 2, 3] },
        { tool: 'marker', color: '#00ff00', size: 9, points: [1, 2] },
      ],
      bounds: { x: 1, y: 2, w: 3, h: 4 },
    })!
    expect(d.strokes).toHaveLength(1)
    expect(d.strokes[0]).toMatchObject({ color: '#2b221b', pressure: true })
    expect(d.bounds).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  })
})

describe('classifyPointer (palm rejection)', () => {
  const opts = (fingerMode: FingerMode = 'auto', penSeen = false, penActive = false) => ({ fingerMode, penSeen, penActive })
  const touch = { pointerType: 'touch', button: 0, buttons: 1, width: 20, height: 20 }
  const pen = { pointerType: 'pen', button: 0, buttons: 1 }

  it('pen draws; its eraser end and barrel button erase', () => {
    expect(classifyPointer(pen, opts())).toBe('draw')
    expect(classifyPointer({ ...pen, buttons: 32, button: 5 }, opts())).toBe('erase')
    expect(classifyPointer({ ...pen, buttons: 3 }, opts())).toBe('erase')
  })
  it('fingers draw until a pen is used, then move the view', () => {
    expect(classifyPointer(touch, opts('auto', false))).toBe('draw')
    expect(classifyPointer(touch, opts('auto', true))).toBe('gesture')
    expect(classifyPointer(touch, opts('draw', true))).toBe('draw')
    expect(classifyPointer(touch, opts('move', false))).toBe('gesture')
  })
  it('ignores palms and any touch while the pen is down', () => {
    expect(classifyPointer({ ...touch, width: 80, height: 70 }, opts('draw'))).toBe('ignore')
    expect(classifyPointer(touch, opts('draw', true, true))).toBe('ignore')
  })
  it('mouse: left draws, middle and right drag', () => {
    expect(classifyPointer({ pointerType: 'mouse', button: 0, buttons: 1 }, opts())).toBe('draw')
    expect(classifyPointer({ pointerType: 'mouse', button: 1, buttons: 4 }, opts())).toBe('gesture')
  })
})
