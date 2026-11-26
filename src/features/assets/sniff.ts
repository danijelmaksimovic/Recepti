/**
 * Work out what a picked file really is from its first bytes, falling back to
 * the MIME type and extension (iOS sometimes reports an empty type).
 */

export type FileFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg' | 'heic' | 'unknown'

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))

export function sniffBytes(b: Uint8Array): FileFormat {
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp'
  if (b.length >= 4 && ascii(b, 0, 4) === 'GIF8') return 'gif'
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(ascii(b, 8, 12))) {
    return ascii(b, 8, 12) === 'avif' ? 'unknown' : 'heic'
  }
  const head = new TextDecoder().decode(b).replace(/^﻿/, '').trimStart().toLowerCase()
  if (head.startsWith('<svg') || ((head.startsWith('<?xml') || head.startsWith('<!--') || head.startsWith('<!doctype svg')) && head.includes('<svg'))) return 'svg'
  return 'unknown'
}

export function formatFromName(type: string, name: string): FileFormat {
  const t = type.toLowerCase()
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (t === 'image/png' || ext === 'png') return 'png'
  if (t === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (t === 'image/webp' || ext === 'webp') return 'webp'
  if (t === 'image/gif' || ext === 'gif') return 'gif'
  if (t === 'image/svg+xml' || ext === 'svg') return 'svg'
  if (/hei[cf]/.test(t) || ext === 'heic' || ext === 'heif') return 'heic'
  return 'unknown'
}

export async function detectFormat(file: Blob & { name?: string }): Promise<FileFormat> {
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer())
  const sniffed = sniffBytes(head)
  return sniffed !== 'unknown' ? sniffed : formatFromName(file.type, file.name ?? '')
}

export const MAX_FILE_BYTES = 60 * 1024 * 1024

export const HEIC_MESSAGE =
  'HEIC photos can’t be opened here. On iPhone, pick them through the photo picker (they arrive as JPG); on a computer, export them as JPG or PNG first.'

/** Accept attribute for file inputs. */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg,.png,.jpg,.jpeg,.webp'
export const PHOTO_ACCEPT = 'image/*'

/** How a raster should be stored. */
export type RasterMode = 'photo' | 'graphic'

/**
 * Photos are re-encoded and downscaled; graphics (drawings, stickers, icons)
 * keep their size and transparency (BLUEPRINT §6).
 */
export function chooseMode(format: FileFormat, hasAlpha: boolean, width: number, height: number): RasterMode {
  if (hasAlpha) return 'graphic'
  if (format === 'png' || format === 'gif') return Math.max(width, height) <= 2048 ? 'graphic' : 'photo'
  return 'photo'
}

export const PHOTO_MAX = 2560
/** Keeps graphics inside iOS canvas limits. */
export const GRAPHIC_MAX = 4096

export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scaled: scale < 1 }
}
