/**
 * Prepare a picked recipe photo: downscaled to at most 2560 px (BLUEPRINT §6)
 * in the image worker, plus a thumbnail for the cookbook grid.
 */
import { processImage } from '@/features/assets/processClient'
import { HEIC_MESSAGE, detectFormat } from '@/features/assets/sniff'

export interface PreparedPhoto {
  blob: Blob
  thumb: Blob
  width: number
  height: number
  name: string
}

const THUMB = 720

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const format = await detectFormat(file)
  if (format === 'heic') throw new Error(HEIC_MESSAGE)
  if (format === 'unknown' || format === 'svg') throw new Error('This image format is not supported. Try a JPG or PNG.')
  const r = await processImage({ file, format, mode: 'photo', thumbSide: THUMB })
  return { blob: r.blob, thumb: r.thumb, width: r.width, height: r.height, name: file.name.replace(/\.[a-z0-9]+$/i, '') }
}
