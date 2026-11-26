/**
 * Sketch pad: a separate full-screen drawing surface (raw Canvas 2D + Pointer
 * Events + perfect-freehand), not a mode of the card editor (BLUEPRINT §6).
 *
 * Three layers: a background canvas (transparency checker + the card as a
 * faint guide), an offscreen canvas holding finished strokes, and the visible
 * ink canvas that composites finished strokes with the stroke in progress.
 * The eraser punches holes with destination-out, so it only ever removes ink.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { History } from '@/domain/history'
import { Button } from '@/ui/Button'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { cx } from '@/ui/cx'
import { Icon, type IconName } from '@/ui/Icon'
import { toast } from '@/ui/toast'
import { classifyPointer, type FingerMode } from './input'
import { COLORS, SIZES, TOOLS, addPoint, shapePressure, type SketchData, type SketchTool, type Stroke } from './model'
import { drawStroke, drawStrokes, exportSketch, type SketchExport } from './render'

export interface SketchBackdrop {
  /** The card rendered at `image.width / cardWidth` px per card px. */
  image: HTMLCanvasElement
  cardWidth: number
  /** artboard = card × scale + (dx, dy) */
  scale: number
  dx: number
  dy: number
}

export interface SketchPadProps {
  initial: SketchData
  backdrop?: SketchBackdrop
  title?: string
  onDone: (data: SketchData, image: SketchExport) => void | Promise<void>
  onCancel: () => void
}

interface View {
  scale: number
  x: number
  y: number
}

const TOOL_ICONS: Record<SketchTool, IconName> = { pen: 'pen', pencil: 'pencil', marker: 'marker', eraser: 'eraser' }
const PREFS_KEY = 'sketch.prefs'

interface Prefs {
  tool: SketchTool
  color: string
  sizes: Record<SketchTool, number>
  finger: FingerMode
  penSeen: boolean
  backdrop: boolean
}

function loadPrefs(): Prefs {
  const d: Prefs = { tool: 'pen', color: COLORS[0], sizes: { pen: 1, pencil: 1, marker: 1, eraser: 1 }, finger: 'auto', penSeen: false, backdrop: true }
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>
    return {
      tool: v.tool && v.tool in TOOLS && v.tool !== 'eraser' ? v.tool : d.tool,
      color: typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : d.color,
      sizes: { ...d.sizes, ...(v.sizes ?? {}) },
      finger: v.finger === 'draw' || v.finger === 'move' ? v.finger : 'auto',
      penSeen: !!v.penSeen,
      backdrop: v.backdrop !== false,
    }
  } catch {
    return d
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* private mode */
  }
}

export function SketchPad({ initial, backdrop, title = 'Sketch', onDone, onCancel }: SketchPadProps) {
  const [prefs, setPrefsState] = useState(loadPrefs)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((p) => {
      const next = { ...p, ...patch }
      savePrefs(next)
      return next
    })
  }, [])
  const [eraserOn, setEraserOn] = useState(false)
  const tool: SketchTool = eraserOn ? 'eraser' : prefs.tool
  const toolRef = useRef(tool)
  toolRef.current = tool

  const hostRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLCanvasElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const committed = useRef<HTMLCanvasElement | null>(null)
  const view = useRef<View>({ scale: 1, x: 0, y: 0 })
  const fitScale = useRef(1)
  const dpr = useRef(1)
  const strokes = useRef<Stroke[]>(initial.strokes)
  const history = useRef(new History<Stroke[]>(initial.strokes, 200))
  const [hist, setHist] = useState({ canUndo: false, canRedo: false, empty: initial.strokes.length === 0 })
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const W = initial.width
  const H = initial.height

  // ---- rendering ----------------------------------------------------------
  const dirty = useRef({ bg: true, committed: true, ink: true })
  const frame = useRef(0)
  const live = useRef<{ id: number; stroke: Stroke; pointerType: string; t: number; last: { x: number; y: number } } | null>(null)
  const cursor = useRef<{ x: number; y: number } | null>(null)

  const setArtTransform = (ctx: CanvasRenderingContext2D) => {
    const v = view.current
    const r = dpr.current
    ctx.setTransform(v.scale * r, 0, 0, v.scale * r, v.x * r, v.y * r)
  }

  const render = useCallback(() => {
    frame.current = 0
    const bg = bgRef.current
    const ink = inkRef.current
    const com = committed.current
    if (!bg || !ink || !com) return
    const d = dirty.current
    if (d.bg) {
      const ctx = bg.getContext('2d')!
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, bg.width, bg.height)
      setArtTransform(ctx)
      ctx.save()
      ctx.shadowColor = 'rgba(60,40,20,0.25)'
      ctx.shadowBlur = 18 * dpr.current
      ctx.fillStyle = '#fbf8f3'
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, W, H)
      ctx.clip()
      // Checkerboard: the background is transparent.
      const cell = 14 / view.current.scale
      ctx.fillStyle = '#efe8dc'
      ctx.beginPath()
      for (let y = 0, row = 0; y < H; y += cell, row++) for (let x = (row % 2) * cell; x < W; x += cell * 2) ctx.rect(x, y, cell, cell)
      ctx.fill()
      if (backdrop && prefsRef.current.backdrop) {
        const k = backdrop.image.width / backdrop.cardWidth
        ctx.globalAlpha = 0.5
        ctx.translate(backdrop.dx, backdrop.dy)
        ctx.scale(backdrop.scale / k, backdrop.scale / k)
        ctx.drawImage(backdrop.image, 0, 0)
      }
      ctx.restore()
      d.bg = false
    }
    if (d.committed) {
      const ctx = com.getContext('2d')!
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, com.width, com.height)
      setArtTransform(ctx)
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, W, H)
      ctx.clip()
      drawStrokes(ctx, strokes.current)
      ctx.restore()
      d.committed = false
      d.ink = true
    }
    if (d.ink) {
      const ctx = ink.getContext('2d')!
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, ink.width, ink.height)
      ctx.drawImage(com, 0, 0)
      setArtTransform(ctx)
      if (live.current) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, W, H)
        ctx.clip()
        drawStroke(ctx, live.current.stroke, true)
        ctx.restore()
      }
      const c = cursor.current
      if (c && !live.current) {
        const t = toolRef.current
        const size = SIZES[t][prefsRef.current.sizes[t]] / fitScale.current
        ctx.beginPath()
        ctx.arc(c.x, c.y, Math.max(size / 2, 1 / view.current.scale), 0, Math.PI * 2)
        ctx.lineWidth = 1.25 / view.current.scale
        ctx.strokeStyle = 'rgba(43,34,27,0.6)'
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(c.x, c.y, Math.max(size / 2, 1 / view.current.scale) + 1.25 / view.current.scale, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.stroke()
      }
      d.ink = false
    }
  }, [W, H, backdrop])

  const schedule = useCallback(
    (what: Partial<typeof dirty.current>) => {
      Object.assign(dirty.current, what)
      if (!frame.current) frame.current = requestAnimationFrame(render)
    },
    [render],
  )

  useEffect(() => schedule({ bg: true }), [prefs.backdrop, schedule])
  useEffect(() => schedule({ ink: true }), [tool, prefs.sizes, schedule])

  // ---- view -----------------------------------------------------------------
  const fit = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    const w = host.clientWidth
    const h = host.clientHeight
    const pad = Math.min(24, w * 0.04)
    const s = Math.max(0.01, Math.min((w - pad * 2) / W, (h - pad * 2) / H))
    fitScale.current = s
    view.current = { scale: s, x: (w - W * s) / 2, y: (h - H * s) / 2 }
    schedule({ bg: true, committed: true })
  }, [W, H, schedule])

  const zoomAt = useCallback(
    (scale: number, at: { x: number; y: number }, base = view.current) => {
      const s = Math.min(fitScale.current * 8, Math.max(fitScale.current * 0.5, scale))
      const ax = (at.x - base.x) / base.scale
      const ay = (at.y - base.y) / base.scale
      view.current = { scale: s, x: at.x - ax * s, y: at.y - ay * s }
      schedule({ bg: true, committed: true })
    },
    [schedule],
  )

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    committed.current = document.createElement('canvas')
    let first = true
    const size = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return
      dpr.current = Math.min(2, window.devicePixelRatio || 1)
      for (const c of [bgRef.current, inkRef.current, committed.current]) {
        if (!c) continue
        c.width = Math.round(w * dpr.current)
        c.height = Math.round(h * dpr.current)
      }
      if (first) {
        first = false
        fit()
      } else {
        // Keep the artboard centred on rotate/resize.
        const prevFit = fitScale.current
        const zoom = view.current.scale / prevFit
        fit()
        if (Math.abs(zoom - 1) > 0.01) zoomAt(fitScale.current * zoom, { x: w / 2, y: h / 2 })
      }
    }
    const ro = new ResizeObserver(size)
    ro.observe(host)
    size()
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame.current)
      frame.current = 0
      const c = committed.current
      if (c) c.width = c.height = 0
    }
  }, [fit, zoomAt])

  // ---- history ------------------------------------------------------------
  const syncHist = () => {
    const h = history.current
    setHist({ canUndo: h.canUndo, canRedo: h.canRedo, empty: strokes.current.length === 0 })
  }
  const setStrokes = (next: Stroke[], record = true) => {
    strokes.current = next
    if (record) history.current.push(next)
    schedule({ committed: true })
    syncHist()
  }
  const undo = () => {
    if (live.current) return
    const s = history.current.undo()
    if (s) setStrokes(s, false)
  }
  const redo = () => {
    if (live.current) return
    const s = history.current.redo()
    if (s) setStrokes(s, false)
  }
  const undoRef = useRef({ undo, redo })
  undoRef.current = { undo, redo }

  // ---- input ----------------------------------------------------------------
  useEffect(() => {
    const el = inkRef.current
    if (!el) return
    const gestures = new Map<number, { x: number; y: number }>()
    let gestureStart: { view: View; mid: { x: number; y: number }; dist: number } | null = null
    let penActive = false

    const capture = (id: number) => {
      try {
        el.setPointerCapture(id)
      } catch {
        /* pointer already gone */
      }
    }
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const toArt = (p: { x: number; y: number }) => ({ x: (p.x - view.current.x) / view.current.scale, y: (p.y - view.current.y) / view.current.scale })

    const resetGesture = () => {
      const pts = [...gestures.values()]
      if (!pts.length) return (gestureStart = null)
      const mid = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0]
      const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
      gestureStart = { view: { ...view.current }, mid, dist }
    }

    const commitLive = () => {
      const l = live.current
      live.current = null
      if (l && l.stroke.points.length >= 3) {
        // Draw just the new stroke onto the finished layer; no full redraw needed.
        const com = committed.current
        if (com) {
          const ctx = com.getContext('2d')!
          setArtTransform(ctx)
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, W, H)
          ctx.clip()
          drawStroke(ctx, l.stroke)
          ctx.restore()
        }
        strokes.current = [...strokes.current, l.stroke]
        history.current.push(strokes.current)
        syncHist()
      }
      schedule({ ink: true })
    }
    const discardLive = () => {
      live.current = null
      schedule({ ink: true })
    }

    const pressureOf = (ev: PointerEvent) => (ev.pointerType === 'pen' ? shapePressure(ev.pressure) : 0.5)

    const onDown = (e: PointerEvent) => {
      const p = prefsRef.current
      if (e.pointerType === 'pen') {
        penActive = true
        if (!p.penSeen) {
          setPrefs({ penSeen: true })
          if (p.finger === 'auto') {
            setHint('Pen found: fingers now move and zoom, so your hand can rest on the screen.')
            setTimeout(() => setHint(null), 5000)
          }
        }
        // A palm that landed first: drop whatever it started.
        if (live.current && live.current.pointerType === 'touch') discardLive()
        if (gestures.size) {
          gestures.clear()
          gestureStart = null
        }
      }
      const action = classifyPointer(e, { fingerMode: p.finger, penSeen: p.penSeen || e.pointerType === 'pen', penActive: penActive && e.pointerType !== 'pen' })
      if (action === 'ignore') return
      e.preventDefault()

      if (action === 'gesture' || (e.pointerType === 'touch' && live.current?.pointerType === 'touch')) {
        // A second finger while drawing turns the touch into a pinch.
        const l = live.current
        if (l && l.pointerType === 'touch') {
          if (performance.now() - l.t < 300 || l.stroke.points.length < 18) discardLive()
          else commitLive()
          // The drawing finger becomes the pinch's first finger.
          gestures.set(l.id, l.last)
        }
        if (live.current) return
        capture(e.pointerId)
        gestures.set(e.pointerId, local(e))
        resetGesture()
        return
      }
      if (live.current || gestures.size) return
      capture(e.pointerId)
      const t: SketchTool = action === 'erase' ? 'eraser' : toolRef.current
      const stroke: Stroke = {
        tool: t,
        color: p.color,
        size: Math.round((SIZES[t][p.sizes[t]] / fitScale.current) * 10) / 10,
        points: [],
        pressure: e.pointerType === 'pen',
      }
      const at = local(e)
      const a = toArt(at)
      addPoint(stroke, a.x, a.y, pressureOf(e))
      live.current = { id: e.pointerId, stroke, pointerType: e.pointerType, t: performance.now(), last: at }
      cursor.current = null
      schedule({ ink: true })
    }

    const onMove = (e: PointerEvent) => {
      const l = live.current
      if (l && e.pointerId === l.id) {
        e.preventDefault()
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
        for (const ev of events.length ? events : [e]) {
          const a = toArt(local(ev))
          addPoint(l.stroke, a.x, a.y, pressureOf(ev))
        }
        l.last = local(e)
        schedule({ ink: true })
        return
      }
      if (gestures.has(e.pointerId)) {
        e.preventDefault()
        gestures.set(e.pointerId, local(e))
        const g = gestureStart
        if (!g) return
        const pts = [...gestures.values()]
        if (pts.length > 1 && g.dist > 0) {
          const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
          const moved = { ...g.view, x: g.view.x + mid.x - g.mid.x, y: g.view.y + mid.y - g.mid.y }
          zoomAt(g.view.scale * (dist / g.dist), mid, moved)
        } else {
          const pt = pts[0]
          view.current = { ...g.view, x: g.view.x + pt.x - g.mid.x, y: g.view.y + pt.y - g.mid.y }
          schedule({ bg: true, committed: true })
        }
        return
      }
      // Hovering pen or mouse: show the brush outline.
      if ((e.pointerType === 'pen' || e.pointerType === 'mouse') && e.buttons === 0) {
        cursor.current = toArt(local(e))
        schedule({ ink: true })
      }
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'pen') penActive = false
      if (live.current && e.pointerId === live.current.id) {
        if (e.type === 'pointercancel' && live.current.pointerType === 'touch') discardLive()
        else commitLive()
        return
      }
      if (gestures.delete(e.pointerId)) resetGesture()
    }
    const onLeave = () => {
      if (cursor.current) {
        cursor.current = null
        schedule({ ink: true })
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      if (e.ctrlKey || e.metaKey) zoomAt(view.current.scale * Math.exp(-e.deltaY * 0.01), p)
      else {
        view.current = { ...view.current, x: view.current.x - e.deltaX, y: view.current.y - e.deltaY }
        schedule({ bg: true, committed: true })
      }
    }
    // iOS: no magnifier, callout or page zoom while drawing.
    const stop = (e: Event) => e.preventDefault()
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) undoRef.current.redo()
        else undoRef.current.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        undoRef.current.redo()
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', stop, { passive: false })
    el.addEventListener('touchmove', stop, { passive: false })
    el.addEventListener('gesturestart', stop)
    el.addEventListener('contextmenu', stop)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove', stop)
      el.removeEventListener('gesturestart', stop)
      el.removeEventListener('contextmenu', stop)
      window.removeEventListener('keydown', onKey)
    }
    // Handlers read live values through refs.
  }, [schedule, zoomAt, setPrefs, W, H]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- actions --------------------------------------------------------------
  const done = async () => {
    if (busy) return
    setBusy(true)
    try {
      const data: SketchData = { ...initial, strokes: strokes.current }
      const out = await exportSketch(data)
      if (!out) {
        toast('Draw something first.')
        return
      }
      await onDone({ ...data, bounds: out.bounds }, out)
    } catch (e) {
      console.error(e)
      toast('The drawing could not be saved.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const cancel = () => (history.current.canUndo ? setConfirm(true) : onCancel())

  const sizes = SIZES[tool]
  const sizeIdx = prefs.sizes[tool]

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-paper-2 pt-safe pr-[var(--safe-right)] pl-[var(--safe-left)]" role="dialog" aria-label={title}>
      <header className="z-10 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-paper/95 px-2 backdrop-blur">
        <Button variant="ghost" onClick={cancel}>
          Cancel
        </Button>
        <p className="min-w-0 flex-1 truncate text-center font-display text-[17px] font-semibold">{title}</p>
        <button type="button" aria-label="Undo" title="Undo" disabled={!hist.canUndo} onClick={undo} className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2 disabled:opacity-30">
          <Icon name="undo" />
        </button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!hist.canRedo} onClick={redo} className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2 disabled:opacity-30">
          <Icon name="redo" />
        </button>
        <Button onClick={() => void done()} disabled={busy || hist.empty} className="ml-1 disabled:opacity-40">
          {busy ? 'Saving…' : 'Done'}
        </Button>
      </header>

      <div ref={hostRef} className="relative min-h-0 flex-1 touch-none overflow-hidden select-none [-webkit-touch-callout:none]" data-testid="sketch-host">
        <canvas ref={bgRef} className="absolute inset-0 size-full" />
        <canvas ref={inkRef} className="absolute inset-0 size-full touch-none" style={{ cursor: 'crosshair' }} data-testid="sketch-canvas" />
        {hint && (
          <div role="status" className="pointer-events-none absolute top-3 left-1/2 w-[min(92%,26rem)] -translate-x-1/2 rounded-2xl bg-ink/85 px-4 py-2.5 text-center text-sm text-paper">
            {hint}
          </div>
        )}
      </div>

      <div className="z-10 shrink-0 border-t border-line bg-paper/95 pb-safe backdrop-blur">
        <div className="no-scrollbar flex items-center gap-3 overflow-x-auto px-3 pt-2.5 pb-1.5">
          <div role="radiogroup" aria-label="Brush" className="flex shrink-0 rounded-xl bg-paper-2 p-1">
            {(Object.keys(TOOLS) as SketchTool[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tool === t}
                aria-label={TOOLS[t].label}
                title={TOOLS[t].label}
                onClick={() => {
                  if (t === 'eraser') setEraserOn(true)
                  else {
                    setEraserOn(false)
                    setPrefs({ tool: t })
                  }
                }}
                className={cx('flex size-10 items-center justify-center rounded-lg transition', tool === t ? 'bg-surface text-accent shadow-card' : 'text-ink-2')}
              >
                <Icon name={TOOL_ICONS[t]} size={21} />
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Brush size" className="flex shrink-0 items-center rounded-xl bg-paper-2 p-1">
            {sizes.map((_s, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={sizeIdx === i}
                aria-label={`Size ${i + 1}`}
                onClick={() => setPrefs({ sizes: { ...prefs.sizes, [tool]: i } })}
                className={cx('flex size-10 items-center justify-center rounded-lg transition', sizeIdx === i && 'bg-surface shadow-card')}
              >
                <span className="rounded-full bg-ink" style={{ width: Math.min(26, 3 + i * 6), height: Math.min(26, 3 + i * 6), opacity: sizeIdx === i ? 1 : 0.45 }} />
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Colour" className={cx('flex shrink-0 items-center gap-1.5', tool === 'eraser' && 'pointer-events-none opacity-35')}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={prefs.color === c}
                aria-label={`Colour ${c}`}
                onClick={() => {
                  setEraserOn(false)
                  setPrefs({ color: c })
                }}
                className={cx('size-8 shrink-0 rounded-full ring-1 ring-ink/15 transition', prefs.color === c && 'ring-2 ring-accent ring-offset-2 ring-offset-paper')}
                style={{ background: c }}
              />
            ))}
            <label className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-ink/15" title="Other colour" style={{ background: 'conic-gradient(#e44,#ec4,#4c4,#4ce,#44e,#c4e,#e44)' }}>
              <input
                type="color"
                aria-label="Other colour"
                value={prefs.color}
                onChange={(e) => {
                  setEraserOn(false)
                  setPrefs({ color: e.target.value })
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 pt-1 pb-2.5">
          <div role="radiogroup" aria-label="Fingers" className="flex shrink-0 items-center rounded-xl bg-paper-2 p-1 text-xs font-medium">
            <span className="px-2 text-ink-3">Fingers</span>
            {(
              [
                ['auto', 'Auto'],
                ['draw', 'Draw'],
                ['move', 'Move'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={prefs.finger === v}
                title={v === 'auto' ? 'Fingers draw until you use a pen, then they move and zoom' : v === 'draw' ? 'Fingers always draw' : 'Fingers only move and zoom'}
                onClick={() => setPrefs({ finger: v })}
                className={cx('h-8 rounded-lg px-2.5 transition', prefs.finger === v ? 'bg-surface text-ink shadow-card' : 'text-ink-2')}
              >
                {l}
              </button>
            ))}
          </div>
          {backdrop && (
            <button
              type="button"
              aria-pressed={prefs.backdrop}
              onClick={() => setPrefs({ backdrop: !prefs.backdrop })}
              className={cx('flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition', prefs.backdrop ? 'bg-accent/12 text-accent' : 'bg-paper-2 text-ink-2')}
            >
              <Icon name={prefs.backdrop ? 'eye' : 'eyeOff'} size={17} />
              Show card
            </button>
          )}
          <button type="button" onClick={fit} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-paper-2 px-3 text-xs font-medium text-ink-2">
            <Icon name="expand" size={17} />
            Fit
          </button>
          <button
            type="button"
            disabled={hist.empty}
            onClick={() => setStrokes([])}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-paper-2 px-3 text-xs font-medium text-danger disabled:opacity-35"
          >
            <Icon name="trash" size={17} />
            Clear
          </button>
        </div>
      </div>

      <ConfirmSheet
        open={confirm}
        title="Discard this drawing?"
        body="Your changes to the drawing will be lost."
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          setConfirm(false)
          onCancel()
        }}
        onClose={() => setConfirm(false)}
      />
    </div>
  )
}
