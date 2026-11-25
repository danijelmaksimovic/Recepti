import type { Difficulty } from './types'

/** 45 → "45 min", 90 → "1 h 30 min", 120 → "2 h". */
export function formatMinutes(min: number | undefined): string | undefined {
  if (min === undefined) return undefined
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

/** "25 Nov 2026" in the user's locale. */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
