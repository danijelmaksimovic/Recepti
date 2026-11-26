/**
 * Raster decoding and re-encoding. Runs inside the image worker when the
 * browser has OffscreenCanvas, otherwise on the main thread with the same code.
 */
import { GRAPHIC_MAX, PHOTO_MAX, chooseMode, fitWithin, type FileFormat, type RasterMode } from './sniff'

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement
type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

export interface CanvasEnv {
  create(width: number, height: number): AnyCanvas
  encode(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob>
}

export const offscreenEnv: CanvasEnv = {
  create: (w, h) => new OffscreenCanvas(w, h),
  encode: (c, type, quality) => (c as OffscreenCanvas).convertToBlob({ type, quality }),
}

export const domEnv: CanvasEnv = {
  create: (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  },
  encode: (c, type, quality) =>
    new Promise((resolve, reject) => (c as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), type, quality)),
}

export interface ProcessRequest {
  file: Blob
  format: FileFormat
  /** 'auto' picks photo or graphic from transparency and format. */
  mode: RasterMode | 'auto'
  thumbSide: number
}

export interface ProcessResult {
  blob: Blob
  thumb: Blob
  width: number
  height: number
  hasAlpha: boolean
  mode: RasterMode
}

function context(c: AnyCanvas): Ctx2D {
  const g = c.getContext('2d') as Ctx2D | null
  if (!g) throw new Error('Image processing is not available in this browser.')
  return g
}

function release(c: AnyCanvas) {
  // Free the backing store right away; iOS has a tight total canvas budget.
  c.width = c.height = 0
}

/** True if any pixel is noticeably see-through (checked on a small copy). */
function detectAlpha(bitmap: ImageBitmap, env: CanvasEnv): boolean {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, 96)
  const c = env.create(width, height)
  try {
    const g = context(c)
    g.drawImage(bitmap, 0, 0, width, height)
    const data = g.getImageData(0, 0, width, height).data
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true
    return false
  } finally {
    release(c)
  }
}

async function draw(bitmap: ImageBitmap, width: number, height: number, type: string, quality: number, env: CanvasEnv) {
  const c = env.create(width, height)
  try {
    const g = context(c)
    g.imageSmoothingQuality = 'high'
    g.drawImage(bitmap, 0, 0, width, height)
    return await env.encode(c, type, quality)
  } finally {
    release(c)
  }
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    try {
      return await createImageBitmap(file)
    } catch {
      throw new Error('This image could not be opened. Try a JPG or PNG.')
    }
  }
}

export async function processRaster(req: ProcessRequest, env: CanvasEnv): Promise<ProcessResult> {
  const bitmap = await decode(req.file)
  try {
    const hasAlpha = req.format !== 'jpeg' && detectAlpha(bitmap, env)
    const mode = req.mode === 'auto' ? chooseMode(req.format, hasAlpha, bitmap.width, bitmap.height) : req.mode
    const size = fitWithin(bitmap.width, bitmap.height, mode === 'photo' ? PHOTO_MAX : GRAPHIC_MAX)
    const type = hasAlpha ? 'image/png' : 'image/jpeg'
    // Graphics keep their exact original bytes when nothing needs changing.
    const keepOriginal = mode === 'graphic' && !size.scaled && (req.format === 'png' || req.format === 'webp')
    const blob = keepOriginal ? req.file : await draw(bitmap, size.width, size.height, type, 0.9, env)
    const t = fitWithin(bitmap.width, bitmap.height, req.thumbSide)
    const thumb = await draw(bitmap, t.width, t.height, type, 0.8, env)
    return { blob, thumb, width: size.width, height: size.height, hasAlpha, mode }
  } finally {
    bitmap.close()
  }
}
