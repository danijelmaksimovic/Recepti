import { describe, expect, it } from 'vitest'
import { alignBoxes, distributeBoxes, snapToGuides, unionBox } from '../align'

const card = { x: 0, y: 0, w: 1000, h: 800 }

describe('alignBoxes', () => {
  const boxes = [
    { x: 100, y: 50, w: 200, h: 100 },
    { x: 400, y: 300, w: 100, h: 50 },
  ]
  it('aligns to the left, centre and right of a target', () => {
    expect(alignBoxes(boxes, card, 'left').map((d) => d.dx)).toEqual([-100, -400])
    expect(alignBoxes(boxes, card, 'hcenter').map((d) => d.dx)).toEqual([300, 50])
    expect(alignBoxes(boxes, card, 'right').map((d) => d.dx)).toEqual([700, 500])
  })
  it('aligns vertically without moving horizontally', () => {
    const d = alignBoxes(boxes, unionBox(boxes), 'bottom')
    expect(d).toEqual([
      { dx: 0, dy: 200 },
      { dx: 0, dy: 0 },
    ])
    expect(alignBoxes(boxes, card, 'vcenter').map((x) => x.dy)).toEqual([300, 75])
  })
})

describe('distributeBoxes', () => {
  it('makes the gaps equal and keeps the outer boxes in place', () => {
    const boxes = [
      { x: 0, y: 0, w: 100, h: 10 },
      { x: 500, y: 0, w: 100, h: 10 },
      { x: 150, y: 0, w: 100, h: 10 },
    ]
    const d = distributeBoxes(boxes, 'x')
    expect(d[0].dx).toBe(0)
    expect(d[1].dx).toBe(0)
    expect(d[2].dx).toBe(100) // gap of 150 on both sides of the middle box
  })
  it('does nothing for fewer than three boxes', () => {
    expect(distributeBoxes([{ x: 0, y: 0, w: 1, h: 1 }, { x: 9, y: 9, w: 1, h: 1 }], 'y')).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
    ])
  })
})

describe('snapToGuides', () => {
  it('snaps a box near the card centre onto it and reports the guide', () => {
    const r = snapToGuides({ x: 447, y: 100, w: 100, h: 50 }, { width: 1000, height: 800 }, [], 6)
    expect(r.dx).toBe(3)
    expect(r.dy).toBe(0)
    expect(r.guides).toContainEqual(expect.objectContaining({ axis: 'x', at: 500 }))
  })
  it('snaps to another object’s edge', () => {
    const other = { x: 600, y: 300, w: 100, h: 100 }
    const r = snapToGuides({ x: 200, y: 296, w: 80, h: 40 }, { width: 1000, height: 800 }, [other], 6)
    expect(r.dy).toBe(4)
    expect(r.guides.some((g) => g.axis === 'y' && g.at === 300)).toBe(true)
  })
  it('leaves a box alone when nothing is close', () => {
    const r = snapToGuides({ x: 123, y: 217, w: 80, h: 40 }, { width: 1000, height: 800 }, [], 4)
    expect(r).toEqual({ dx: 0, dy: 0, guides: [] })
  })
})
