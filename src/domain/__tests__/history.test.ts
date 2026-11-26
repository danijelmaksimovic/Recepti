import { describe, expect, it } from 'vitest'
import { History } from '../history'

describe('History', () => {
  it('undoes and redoes in order', () => {
    const h = new History('a')
    h.push('b')
    h.push('c')
    expect(h.undo()).toBe('b')
    expect(h.undo()).toBe('a')
    expect(h.undo()).toBeUndefined()
    expect(h.redo()).toBe('b')
    expect(h.present).toBe('b')
  })
  it('ignores a push equal to the current state', () => {
    const h = new History('a')
    expect(h.push('a')).toBe(false)
    expect(h.canUndo).toBe(false)
  })
  it('drops redo steps after a new change', () => {
    const h = new History(1)
    h.push(2)
    h.undo()
    h.push(3)
    expect(h.canRedo).toBe(false)
    expect(h.undo()).toBe(1)
  })
  it('keeps at most `limit` undo steps', () => {
    const h = new History(0, 3)
    for (let i = 1; i <= 10; i++) h.push(i)
    let n = 0
    while (h.undo() !== undefined) n++
    expect(n).toBe(3)
    expect(h.present).toBe(7)
  })
})
