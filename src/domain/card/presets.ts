/**
 * Canvas presets (BLUEPRINT §5). Sizes are stored in physical units for print
 * and pages; the editor works in fixed logical pixels (print at 300 DPI) and
 * zoom is view-only, so a card never changes size when you zoom.
 */

export type PresetGroup = 'digital' | 'print' | 'page'
export type Orientation = 'portrait' | 'landscape'

export interface CanvasPreset {
  id: string
  label: string
  group: PresetGroup
  /** Short line under the label, e.g. "1080 × 1350 px" or "4 × 6 in". */
  hint: string
  /** Portrait size in logical px. */
  width: number
  height: number
  /** Physical size (portrait) for print and pages. */
  physical?: { width: number; height: number; unit: 'in' | 'mm' }
}

export const PRINT_DPI = 300
export const MIN_SIDE = 200
export const MAX_SIDE = 4000

const inch = (w: number, h: number) => ({ width: Math.round(w * PRINT_DPI), height: Math.round(h * PRINT_DPI) })
const mm = (w: number, h: number) => ({ width: Math.round((w / 25.4) * PRINT_DPI), height: Math.round((h / 25.4) * PRINT_DPI) })

export const PRESETS: CanvasPreset[] = [
  { id: 'digital-4x5', label: 'Social 4:5', group: 'digital', hint: '1080 × 1350 px', width: 1080, height: 1350 },
  { id: 'digital-2x3', label: 'Card 2:3', group: 'digital', hint: '1000 × 1500 px', width: 1000, height: 1500 },
  { id: 'digital-9x16', label: 'Story 9:16', group: 'digital', hint: '1080 × 1920 px', width: 1080, height: 1920 },
  { id: 'digital-1x1', label: 'Square 1:1', group: 'digital', hint: '1080 × 1080 px', width: 1080, height: 1080 },
  { id: 'print-3x5', label: 'Index card 3×5″', group: 'print', hint: '3 × 5 in · 300 DPI', ...inch(3, 5), physical: { width: 3, height: 5, unit: 'in' } },
  { id: 'print-4x6', label: 'Recipe card 4×6″', group: 'print', hint: '4 × 6 in · 300 DPI', ...inch(4, 6), physical: { width: 4, height: 6, unit: 'in' } },
  { id: 'print-5x7', label: 'Card 5×7″', group: 'print', hint: '5 × 7 in · 300 DPI', ...inch(5, 7), physical: { width: 5, height: 7, unit: 'in' } },
  { id: 'print-a6', label: 'A6', group: 'print', hint: '105 × 148 mm · 300 DPI', ...mm(105, 148), physical: { width: 105, height: 148, unit: 'mm' } },
  { id: 'print-a5', label: 'A5', group: 'print', hint: '148 × 210 mm · 300 DPI', ...mm(148, 210), physical: { width: 148, height: 210, unit: 'mm' } },
  { id: 'page-a4', label: 'A4 page', group: 'page', hint: '210 × 297 mm · 300 DPI', ...mm(210, 297), physical: { width: 210, height: 297, unit: 'mm' } },
  { id: 'page-letter', label: 'Letter page', group: 'page', hint: '8.5 × 11 in · 300 DPI', ...inch(8.5, 11), physical: { width: 8.5, height: 11, unit: 'in' } },
]

export const CUSTOM_PRESET_ID = 'custom'
export const DEFAULT_PRESET_ID = 'print-4x6'

export const GROUP_LABELS: Record<PresetGroup, string> = {
  digital: 'Digital',
  print: 'Printable cards',
  page: 'Recipe pages',
}

export function getPreset(id: string): CanvasPreset | undefined {
  return PRESETS.find((p) => p.id === id)
}

export function orientationOf(width: number, height: number): Orientation {
  return width > height ? 'landscape' : 'portrait'
}

/** Logical size of a preset in the given orientation. Square presets ignore orientation. */
export function presetSize(preset: CanvasPreset, orientation: Orientation): { width: number; height: number } {
  const { width, height } = preset
  return orientation === 'landscape' ? { width: Math.max(width, height), height: Math.min(width, height) } : { width, height }
}

export function clampSide(n: number): number {
  if (!Number.isFinite(n)) return MIN_SIDE
  return Math.min(MAX_SIDE, Math.max(MIN_SIDE, Math.round(n)))
}

/** Human description of a design's size, e.g. "Recipe card 4×6″ · landscape" or "1200 × 900 px". */
export function describeSize(presetId: string, width: number, height: number): string {
  const p = getPreset(presetId)
  if (!p) return `${width} × ${height} px`
  if (p.width === p.height) return p.label
  return `${p.label} · ${orientationOf(width, height)}`
}
