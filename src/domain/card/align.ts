/**
 * Pure geometry for arranging card objects: aligning, distributing and the
 * smart-guide snapping used while dragging. Everything works on axis-aligned
 * boxes in card px, so it is independent of Fabric and easy to test.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
export type Axis = 'x' | 'y'

export interface Delta {
  dx: number
  dy: number
}

/** Offsets that align every box to `to` (the card, or the selection's bounds). */
export function alignBoxes(boxes: Box[], to: Box, mode: AlignMode): Delta[] {
  return boxes.map((b) => {
    switch (mode) {
      case 'left':
        return { dx: to.x - b.x, dy: 0 }
      case 'hcenter':
        return { dx: to.x + to.w / 2 - (b.x + b.w / 2), dy: 0 }
      case 'right':
        return { dx: to.x + to.w - (b.x + b.w), dy: 0 }
      case 'top':
        return { dx: 0, dy: to.y - b.y }
      case 'vcenter':
        return { dx: 0, dy: to.y + to.h / 2 - (b.y + b.h / 2) }
      case 'bottom':
        return { dx: 0, dy: to.y + to.h - (b.y + b.h) }
    }
  })
}

/** Spread boxes so the gaps between them are equal; the outermost two stay put. */
export function distributeBoxes(boxes: Box[], axis: Axis): Delta[] {
  const out: Delta[] = boxes.map(() => ({ dx: 0, dy: 0 }))
  if (boxes.length < 3) return out
  const pos = (b: Box) => (axis === 'x' ? b.x : b.y)
  const size = (b: Box) => (axis === 'x' ? b.w : b.h)
  const order = boxes.map((b, i) => ({ b, i })).sort((p, q) => pos(p.b) - pos(q.b))
  const first = order[0].b
  const last = order.reduce((m, p) => (pos(p.b) + size(p.b) > pos(m) + size(m) ? p.b : m), first)
  const span = pos(last) + size(last) - pos(first)
  const total = order.reduce((s, p) => s + size(p.b), 0)
  const gap = (span - total) / (order.length - 1)
  let at = pos(first)
  for (const { b, i } of order) {
    const d = at - pos(b)
    out[i] = axis === 'x' ? { dx: d, dy: 0 } : { dx: 0, dy: d }
    at += size(b) + gap
  }
  return out
}

export function unionBox(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const r = Math.max(...boxes.map((b) => b.x + b.w))
  const btm = Math.max(...boxes.map((b) => b.y + b.h))
  return { x, y, w: r - x, h: btm - y }
}

/** A guide line to draw: vertical at `at` (x) from `from` to `to` (y), or horizontal. */
export interface Guide {
  axis: Axis
  at: number
  from: number
  to: number
}

export interface SnapResult extends Delta {
  guides: Guide[]
}

/**
 * Snap a moving box to the edges and centres of the card and of other boxes.
 * `threshold` is in card px (pass a screen distance divided by the zoom).
 */
export function snapToGuides(moving: Box, card: { width: number; height: number }, others: Box[], threshold: number): SnapResult {
  const targets = [{ x: 0, y: 0, w: card.width, h: card.height }, ...others]
  const lines = (b: Box, axis: Axis) => (axis === 'x' ? [b.x, b.x + b.w / 2, b.x + b.w] : [b.y, b.y + b.h / 2, b.y + b.h])

  const best = (axis: Axis) => {
    let delta = 0
    let dist = threshold + 1e-9
    for (const t of targets) {
      for (const tl of lines(t, axis)) {
        for (const ml of lines(moving, axis)) {
          const d = tl - ml
          if (Math.abs(d) < dist) {
            dist = Math.abs(d)
            delta = d
          }
        }
      }
    }
    return dist <= threshold ? delta : null
  }

  const dx = best('x')
  const dy = best('y')
  const snapped = { x: moving.x + (dx ?? 0), y: moving.y + (dy ?? 0), w: moving.w, h: moving.h }
  const guides: Guide[] = []
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5
  // Every line the snapped box now shares with a target gets drawn.
  for (const axis of ['x', 'y'] as const) {
    if ((axis === 'x' ? dx : dy) === null) continue
    const seen = new Set<number>()
    for (const t of targets) {
      for (const tl of lines(t, axis)) {
        if (seen.has(Math.round(tl)) || !lines(snapped, axis).some((ml) => near(ml, tl))) continue
        seen.add(Math.round(tl))
        const [a0, a1] = axis === 'x' ? [Math.min(t.y, snapped.y), Math.max(t.y + t.h, snapped.y + snapped.h)] : [Math.min(t.x, snapped.x), Math.max(t.x + t.w, snapped.x + snapped.w)]
        guides.push({ axis, at: tl, from: a0, to: a1 })
      }
    }
  }
  return { dx: dx ?? 0, dy: dy ?? 0, guides }
}
