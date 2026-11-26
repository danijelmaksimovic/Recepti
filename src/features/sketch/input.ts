/**
 * What a pointer should do on the sketch pad. Kept pure so the palm-rejection
 * rules are easy to test.
 *
 * - Pen (Huawei M-Pencil on Android Chrome, Apple Pencil, Wacom…): draws with
 *   real pressure. The eraser end (buttons & 32) or barrel button (buttons & 2)
 *   erases.
 * - Finger: draws until a pen has been used ("auto"); after that fingers only
 *   move and zoom the page, so a resting palm never leaves marks. The person
 *   can force either behaviour.
 * - Very large contacts are treated as a palm and ignored.
 * - Mouse: left draws, middle or right drags the view.
 */

export type FingerMode = 'auto' | 'draw' | 'move'
export type PointerAction = 'draw' | 'erase' | 'gesture' | 'ignore'

export interface PointerLike {
  pointerType: string
  button: number
  buttons: number
  width?: number
  height?: number
}

/** Contact size (CSS px) above which a touch is taken for a palm. */
export const PALM_SIZE = 56

export function fingersDraw(mode: FingerMode, penSeen: boolean) {
  return mode === 'draw' || (mode === 'auto' && !penSeen)
}

export function classifyPointer(e: PointerLike, opts: { fingerMode: FingerMode; penSeen: boolean; penActive: boolean }): PointerAction {
  if (e.pointerType === 'pen') {
    if (e.button === 5 || e.buttons & 32 || e.buttons & 2) return 'erase'
    return 'draw'
  }
  if (e.pointerType === 'touch') {
    // Never let a hand do anything while the pen is on the screen.
    if (opts.penActive) return 'ignore'
    if ((e.width ?? 0) >= PALM_SIZE && (e.height ?? 0) >= PALM_SIZE) return 'ignore'
    return fingersDraw(opts.fingerMode, opts.penSeen) ? 'draw' : 'gesture'
  }
  // Mouse
  if (e.button === 1 || e.button === 2) return 'gesture'
  return 'draw'
}
