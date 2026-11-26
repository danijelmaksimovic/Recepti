/** Canvas 2D drawing of sketch strokes, and export to a trimmed transparent PNG. */
import { TOOLS, inkBounds, outlinePath, strokeOutline, type Bounds, type SketchData, type Stroke } from './model'

const paths = new WeakMap<Stroke, Path2D>()

/** Outline of a finished stroke, cached (finished strokes never change). */
export function strokePath(s: Stroke): Path2D {
  let p = paths.get(s)
  if (!p) {
    p = new Path2D(outlinePath(strokeOutline(s)))
    paths.set(s, p)
  }
  return p
}

/** Draw one stroke; the caller has set the artboard → pixels transform. */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, live = false) {
  const path = live ? new Path2D(outlinePath(strokeOutline(s, false))) : strokePath(s)
  ctx.save()
  if (s.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = '#000'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = TOOLS[s.tool].opacity
    ctx.fillStyle = s.color
  }
  ctx.fill(path)
  ctx.restore()
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[]) {
  for (const s of strokes) drawStroke(ctx, s)
}

export interface SketchExport {
  blob: Blob
  thumb: Blob
  width: number
  height: number
  bounds: Bounds
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the drawing'))), 'image/png'))

/** Largest side of the saved image; keeps big drawings inside iOS canvas limits. */
const MAX_SIDE = 3000
const THUMB_SIDE = 512

/** Render the drawn area to a transparent PNG (plus a thumbnail). Null if nothing is drawn. */
export async function exportSketch(data: SketchData): Promise<SketchExport | null> {
  const bounds = inkBounds(data)
  if (!bounds) return null
  const k = Math.min(1, MAX_SIDE / Math.max(bounds.w, bounds.h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bounds.w * k))
  c.height = Math.max(1, Math.round(bounds.h * k))
  const ctx = c.getContext('2d')!
  ctx.setTransform(k, 0, 0, k, -bounds.x * k, -bounds.y * k)
  drawStrokes(ctx, data.strokes)
  const t = document.createElement('canvas')
  const tk = Math.min(1, THUMB_SIDE / Math.max(c.width, c.height))
  t.width = Math.max(1, Math.round(c.width * tk))
  t.height = Math.max(1, Math.round(c.height * tk))
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height)
  try {
    const [blob, thumb] = await Promise.all([toBlob(c), toBlob(t)])
    return { blob, thumb, width: c.width, height: c.height, bounds }
  } finally {
    c.width = c.height = t.width = t.height = 0
  }
}
