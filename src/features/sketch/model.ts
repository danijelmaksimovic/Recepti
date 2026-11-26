/**
 * Sketch data: re-editable strokes stored with a drawing asset (`sketchData`).
 * Strokes are kept as raw input points; their filled outline comes from
 * perfect-freehand, so brushes can be tuned later without losing drawings.
 */
import { getStroke } from 'perfect-freehand'

export const SKETCH_VERSION = 1

export type SketchTool = 'pen' | 'pencil' | 'marker' | 'eraser'

export interface Stroke {
  tool: SketchTool
  color: string
  /** Brush diameter in artboard px. */
  size: number
  /** Flat [x, y, pressure, x, y, pressure, …] in artboard px; pressure 0–1. */
  points: number[]
  /** True when the device reported real pressure (pen); otherwise it's simulated from speed. */
  pressure: boolean
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export interface SketchData {
  version: typeof SKETCH_VERSION
  /** Artboard size in px. */
  width: number
  height: number
  strokes: Stroke[]
  /** The artboard region the saved image shows (set on save). */
  bounds?: Bounds
}

export interface ToolSpec {
  label: string
  thinning: number
  smoothing: number
  streamline: number
  opacity: number
  /** Taper at the start/end, as a multiple of the size. */
  taper: number
}

export const TOOLS: Record<SketchTool, ToolSpec> = {
  pen: { label: 'Pen', thinning: 0.6, smoothing: 0.55, streamline: 0.45, opacity: 1, taper: 0 },
  pencil: { label: 'Pencil', thinning: 0.35, smoothing: 0.35, streamline: 0.3, opacity: 0.82, taper: 1.5 },
  marker: { label: 'Marker', thinning: 0, smoothing: 0.6, streamline: 0.55, opacity: 0.45, taper: 0 },
  eraser: { label: 'Eraser', thinning: 0, smoothing: 0.5, streamline: 0.4, opacity: 1, taper: 0 },
}

/** Brush sizes in screen px at 100% zoom, per tool. */
export const SIZES: Record<SketchTool, number[]> = {
  pen: [3, 6, 11, 20],
  pencil: [2, 4, 7, 12],
  marker: [10, 18, 30, 48],
  eraser: [12, 24, 44, 80],
}

export const COLORS = ['#2b221b', '#7a4a2a', '#b5532f', '#d9822b', '#e8b931', '#5f8a3c', '#2f6f8f', '#7a4d9a', '#c2416b', '#ffffff']

/** Pens report light touches as very low pressure; lift the floor so lines don't vanish. */
export function shapePressure(p: number): number {
  const v = Math.min(1, Math.max(0, p))
  return 0.18 + 0.82 * Math.pow(v, 0.85)
}

export function emptySketch(width: number, height: number): SketchData {
  return { version: SKETCH_VERSION, width: Math.round(width), height: Math.round(height), strokes: [] }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/** Append a point, rounding to keep stored data small and skipping exact repeats. */
export function addPoint(s: Stroke, x: number, y: number, p: number) {
  const n = s.points.length
  const rx = round1(x)
  const ry = round1(y)
  if (n >= 3 && s.points[n - 3] === rx && s.points[n - 2] === ry) {
    s.points[n - 1] = Math.max(s.points[n - 1], round2(p))
    return
  }
  s.points.push(rx, ry, round2(p))
}

function triples(points: number[]): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i + 2 < points.length; i += 3) out.push([points[i], points[i + 1], points[i + 2]])
  return out
}

/** The stroke's filled outline polygon in artboard px. */
export function strokeOutline(s: Stroke, complete = true): [number, number][] {
  const t = TOOLS[s.tool]
  const pts = triples(s.points)
  if (!pts.length) return []
  return getStroke(pts, {
    size: s.size,
    thinning: t.thinning,
    smoothing: t.smoothing,
    streamline: t.streamline,
    simulatePressure: !s.pressure,
    last: complete,
    start: { taper: t.taper ? s.size * t.taper : 0, cap: true },
    end: { taper: t.taper ? s.size * t.taper : 0, cap: true },
  }) as [number, number][]
}

/** SVG-style path data with smoothed curves through the outline points. */
export function outlinePath(outline: [number, number][]): string {
  const n = outline.length
  if (n < 2) return ''
  let d = `M${outline[0][0].toFixed(2)} ${outline[0][1].toFixed(2)}Q`
  for (let i = 0; i < n; i++) {
    const [x0, y0] = outline[i]
    const [x1, y1] = outline[(i + 1) % n]
    d += `${x0.toFixed(2)} ${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)} `
  }
  return d + 'Z'
}

export function outlineBounds(outline: [number, number][]): Bounds | null {
  if (!outline.length) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of outline) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * The region worth saving: everything drawn (eraser strokes can only remove),
 * padded, clipped to the artboard and snapped to whole px. Null when empty.
 */
export function inkBounds(data: SketchData, pad = 6): Bounds | null {
  let acc: Bounds | null = null
  for (const s of data.strokes) {
    if (s.tool === 'eraser') continue
    const b = outlineBounds(strokeOutline(s))
    if (!b) continue
    acc = acc ? union(acc, b) : b
  }
  if (!acc) return null
  const x = Math.max(0, Math.floor(acc.x - pad))
  const y = Math.max(0, Math.floor(acc.y - pad))
  const r = Math.min(data.width, Math.ceil(acc.x + acc.w + pad))
  const b = Math.min(data.height, Math.ceil(acc.y + acc.h + pad))
  if (r <= x || b <= y) return null
  return { x, y, w: r - x, h: b - y }
}

function union(a: Bounds, b: Bounds): Bounds {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

const HEX = /^#[0-9a-f]{6}$/i

/** Validate stored sketch data (from the database or a backup). Returns null if unusable. */
export function cleanSketch(raw: unknown): SketchData | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<SketchData>
  const width = Number(r.width)
  const height = Number(r.height)
  if (!(width > 0 && height > 0 && width <= 8192 && height <= 8192) || !Array.isArray(r.strokes)) return null
  const strokes: Stroke[] = []
  for (const s of r.strokes as Partial<Stroke>[]) {
    if (!s || typeof s !== 'object' || !(s.tool && s.tool in TOOLS) || !Array.isArray(s.points)) continue
    const points = s.points.filter((n) => typeof n === 'number' && Number.isFinite(n))
    if (points.length < 3 || points.length % 3) continue
    strokes.push({
      tool: s.tool,
      color: typeof s.color === 'string' && HEX.test(s.color) ? s.color : '#2b221b',
      size: Math.min(500, Math.max(0.5, Number(s.size) || 4)),
      points,
      pressure: !!s.pressure,
    })
  }
  const b = r.bounds
  const bounds = b && [b.x, b.y, b.w, b.h].every((n) => typeof n === 'number' && Number.isFinite(n)) ? { x: b.x, y: b.y, w: b.w, h: b.h } : undefined
  return { version: SKETCH_VERSION, width, height, strokes, ...(bounds ? { bounds } : {}) }
}
