/**
 * Prepare a picked recipe photo: downscale to at most 2560 px on the long side
 * (BLUEPRINT §6) and make a small thumbnail for the cookbook grid.
 * Phase 6 moves this into a Web Worker together with the full asset importer.
 */
export interface PreparedPhoto {
  blob: Blob
  thumb: Blob
  width: number
  height: number
  name: string
}

const MAX = 2560
const THUMB = 720

async function draw(bitmap: ImageBitmap, max: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
  // Release the backing store right away; iOS has a tight total canvas budget.
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('Could not process this photo.')
  return { blob, width, height }
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('This image format is not supported. Try a JPG or PNG.')
  }
  try {
    const full = await draw(bitmap, MAX, 0.88)
    const thumb = await draw(bitmap, THUMB, 0.8)
    return { blob: full.blob, thumb: thumb.blob, width: full.width, height: full.height, name: file.name }
  } finally {
    bitmap.close()
  }
}
