/**
 * Crop for images on a card, kept independent of the image's pixel size so the
 * same frame works when a bound recipe photo is swapped for another one.
 */

export interface CropSpec {
  /** Width / height of the frame; null keeps the image's own shape. */
  aspect: number | null
  /** 1 = the largest frame that fits; 4 = a quarter of that. */
  zoom: number
  /** Position of the frame inside the image, 0–1 on each axis (0.5 = centred). */
  fx: number
  fy: number
}

export const DEFAULT_CROP: CropSpec = { aspect: null, zoom: 1, fx: 0.5, fy: 0.5 }
export const MAX_CROP_ZOOM = 4

export interface FrameShape {
  id: string
  label: string
  aspect: number | null
  /** Corner radius preset, as a fraction of the short side (0.5 = round). */
  radius?: number
}

export const FRAME_SHAPES: FrameShape[] = [
  { id: 'original', label: 'Original', aspect: null },
  { id: 'square', label: 'Square', aspect: 1 },
  { id: 'portrait', label: '4:5', aspect: 4 / 5 },
  { id: 'landscape', label: '3:2', aspect: 3 / 2 },
  { id: 'wide', label: '16:9', aspect: 16 / 9 },
  { id: 'circle', label: 'Circle', aspect: 1, radius: 0.5 },
]

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/** Accept anything stored in a design and return a usable spec. */
export function cleanCrop(raw: unknown): CropSpec {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Partial<CropSpec>
  const aspect = typeof c.aspect === 'number' && Number.isFinite(c.aspect) && c.aspect > 0 ? clamp(c.aspect, 0.05, 20) : null
  return { aspect, zoom: clamp(num(c.zoom, 1), 1, MAX_CROP_ZOOM), fx: clamp(num(c.fx, 0.5), 0, 1), fy: clamp(num(c.fy, 0.5), 0, 1) }
}

/** The source rectangle, in image pixels, that the frame shows. */
export function cropRect(naturalWidth: number, naturalHeight: number, spec: CropSpec) {
  const s = cleanCrop(spec)
  const aspect = s.aspect ?? naturalWidth / naturalHeight
  let w = naturalWidth
  let h = w / aspect
  if (h > naturalHeight) {
    h = naturalHeight
    w = h * aspect
  }
  w /= s.zoom
  h /= s.zoom
  return { x: (naturalWidth - w) * s.fx, y: (naturalHeight - h) * s.fy, width: w, height: h }
}

/** Which preset shape a spec + radius matches, if any. */
export function shapeOf(spec: CropSpec, radius: number): string | undefined {
  const near = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 0.01)
  const round = radius >= 0.49
  return FRAME_SHAPES.find((f) => near(f.aspect, spec.aspect) && (f.radius === 0.5) === round)?.id
}
