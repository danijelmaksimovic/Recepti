/**
 * CardEditor wraps one Fabric canvas: it owns the card page, zoom and pan,
 * grid and snapping, text binding and serialization. React talks to it through
 * a small method surface and two callbacks, so Fabric never leaks into UI code.
 */
import { Canvas, Point, Rect, Textbox, util, type FabricObject, type TPointerEventInfo } from 'fabric'
import { stripResolvedText, fontsInDoc, type CardBackground, type CardDoc, type CardObjectJSON, CARD_DOC_VERSION, CUSTOM_PROPS } from '@/domain/card/doc'
import { boldWeight, DEFAULT_FONT } from '@/domain/card/fonts'
import { defaultListStyle, getField, token, type ListStyle, type TokenContext } from '@/domain/card/tokens'
import { paintPage, type PageSpec } from './background'
import { isCardText, setupFabric, type CardText } from './setup'
import { applyText, applyTextAll, ensureFonts } from './text'

export interface GridSettings {
  show: boolean
  snap: boolean
  /** Grid spacing in card px. */
  size: number
}

export interface TextSnapshot {
  kind: 'text'
  name: string
  sourceText: string
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  fill: string
  textAlign: string
  charSpacing: number
  lineHeight: number
  angle: number
  opacity: number
  x: number
  y: number
  width: number
  listStyle?: ListStyle
  hasList: boolean
  maxHeight?: number
  shrunk: boolean
  overflow: boolean
}

export interface ShapeSnapshot {
  kind: 'shape'
  name: string
  fill: string
  angle: number
  opacity: number
  x: number
  y: number
  width: number
  height: number
}

export type SelectionSnapshot = TextSnapshot | ShapeSnapshot | { kind: 'multi'; count: number } | null

export interface EditorCallbacks {
  /** The document changed and should be saved. */
  onChange: () => void
  onSelection: (s: SelectionSnapshot) => void
  onZoom: (zoom: number, fit: number) => void
  /** Double-click / double-tap on text. */
  onEditText?: () => void
}

const WORKSPACE = { light: '#e9e0d2', dark: '#171310' }
const MAX_ZOOM = 4

class CardCanvas extends Canvas {
  page!: PageSpec
  grid: GridSettings = { show: false, snap: false, size: 40 }
  workspace = WORKSPACE.light
  _renderBackground(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.workspace
    ctx.fillRect(0, 0, this.width, this.height)
    paintPage(ctx, this.viewportTransform, this.page, { color: 'rgba(60,40,20,0.28)', blur: 24 })
  }
  _renderOverlay(ctx: CanvasRenderingContext2D) {
    const v = this.viewportTransform
    const { width: W, height: H } = this.page
    ctx.save()
    // Dim anything that hangs over the card edge; it won't be in the output.
    ctx.beginPath()
    ctx.rect(0, 0, this.width, this.height)
    ctx.rect(v[4], v[5], W * v[0], H * v[3])
    ctx.fillStyle = this.workspace
    ctx.globalAlpha = 0.82
    ctx.fill('evenodd')
    ctx.globalAlpha = 1
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5])
    const z = v[0]
    if (this.grid.show && this.grid.size * z >= 4) {
      ctx.lineWidth = 1 / z
      ctx.beginPath()
      for (let x = this.grid.size; x < W; x += this.grid.size) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
      }
      for (let y = this.grid.size; y < H; y += this.grid.size) {
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
      }
      ctx.strokeStyle = 'rgba(181,83,47,0.22)'
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(W / 2, 0)
      ctx.lineTo(W / 2, H)
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.strokeStyle = 'rgba(181,83,47,0.5)'
      ctx.stroke()
    }
    // Text box limits and overflow warning for the selected text.
    const active = this.getActiveObject()
    if (isCardText(active) && active.maxHeight) {
      // The box hangs from the text's anchor: down from the top, up from the bottom, or centred.
      const tl = active.getPointByOrigin('left', 'top')
      const shift = active.originY === 'bottom' ? active.height - active.maxHeight : active.originY === 'center' ? (active.height - active.maxHeight) / 2 : 0
      ctx.save()
      ctx.translate(tl.x, tl.y)
      ctx.rotate(util.degreesToRadians(active.angle))
      ctx.setLineDash([6 / z, 5 / z])
      ctx.lineWidth = 1.5 / z
      ctx.strokeStyle = active.overflow ? '#b3261e' : 'rgba(181,83,47,0.7)'
      ctx.strokeRect(0, shift, active.width, active.maxHeight)
      ctx.restore()
    }
    ctx.restore()
  }
}

export class CardEditor {
  readonly canvas: CardCanvas
  private ctx: TokenContext | undefined
  private cb: EditorCallbacks
  private host: HTMLElement
  private loading = false
  private fitZoom = 1
  private autoFit = true
  private pan?: { x: number; y: number }
  private pinch?: { dist: number; mid: { x: number; y: number }; zoom: number }
  private spaceDown = false
  private disposers: (() => void)[] = []

  constructor(el: HTMLCanvasElement, host: HTMLElement, page: PageSpec, ctx: TokenContext | undefined, cb: EditorCallbacks) {
    setupFabric()
    this.host = host
    this.ctx = ctx
    this.cb = cb
    this.canvas = new CardCanvas(el, {
      width: host.clientWidth,
      height: host.clientHeight,
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
      selectionColor: 'rgba(181,83,47,0.08)',
      selectionBorderColor: '#b5532f',
      selectionLineWidth: 1,
      stopContextMenu: true,
      fireMiddleClick: true,
      targetFindTolerance: 6,
    })
    this.canvas.page = page
    this.bindEvents()
    this.fit()
  }

  // ---- document -------------------------------------------------------------

  async load(doc: CardDoc) {
    this.loading = true
    try {
      await ensureFonts(fontsInDoc(doc))
      this.canvas.page = { ...this.canvas.page, background: doc.background }
      this.canvas.discardActiveObject()
      this.canvas.remove(...this.canvas.getObjects())
      const objects = (await util.enlivenObjects(doc.objects)) as FabricObject[]
      applyTextAll(objects, this.ctx, { placeholders: true })
      if (objects.length) this.canvas.add(...objects)
      this.canvas.requestRenderAll()
    } finally {
      this.loading = false
    }
    this.emitSelection()
  }

  toDoc(): CardDoc {
    const objects = this.canvas.getObjects().map((o) => o.toObject([...CUSTOM_PROPS]) as CardObjectJSON)
    return { version: CARD_DOC_VERSION, background: { ...this.canvas.page.background }, objects: stripResolvedText(objects) }
  }

  get page(): PageSpec {
    return this.canvas.page
  }

  /** Recipe content changed: re-resolve every field. */
  setTokenContext(ctx: TokenContext | undefined) {
    this.ctx = ctx
    applyTextAll(this.canvas.getObjects(), ctx, { placeholders: true })
    this.canvas.requestRenderAll()
    this.emitSelection()
  }

  setBackground(patch: Partial<CardBackground>) {
    this.canvas.page = { ...this.canvas.page, background: { ...this.canvas.page.background, ...patch } }
    this.canvas.requestRenderAll()
    this.changed()
  }

  /** Change the card size; objects keep their positions. */
  setCardSize(width: number, height: number) {
    this.canvas.page = { ...this.canvas.page, width, height }
    this.autoFit = true
    this.fit()
    this.changed()
  }

  setGrid(grid: GridSettings) {
    this.canvas.grid = grid
    this.canvas.requestRenderAll()
  }

  setDark(dark: boolean) {
    this.canvas.workspace = dark ? WORKSPACE.dark : WORKSPACE.light
    this.canvas.requestRenderAll()
  }

  // ---- view -----------------------------------------------------------------

  /** Match the canvas to its host element (call on resize). */
  resize() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (!w || !h) return
    this.canvas.setDimensions({ width: w, height: h })
    if (this.autoFit) this.fit()
    else this.computeFit()
    this.canvas.requestRenderAll()
  }

  private computeFit() {
    const { width: W, height: H } = this.canvas.page
    const pad = Math.min(48, this.canvas.width * 0.06)
    this.fitZoom = Math.max(0.02, Math.min((this.canvas.width - pad * 2) / W, (this.canvas.height - pad * 2) / H))
    return this.fitZoom
  }

  get minZoom() {
    return Math.min(0.25, this.fitZoom * 0.5)
  }

  fit() {
    const z = this.computeFit()
    const { width: W, height: H } = this.canvas.page
    this.canvas.setViewportTransform([z, 0, 0, z, (this.canvas.width - W * z) / 2, (this.canvas.height - H * z) / 2])
    this.autoFit = true
    this.cb.onZoom(z, this.fitZoom)
  }

  /** Zoom around a viewport point (defaults to the centre). */
  zoomTo(zoom: number, at?: { x: number; y: number }) {
    const z = Math.min(MAX_ZOOM, Math.max(this.minZoom, zoom))
    const p = at ?? { x: this.canvas.width / 2, y: this.canvas.height / 2 }
    this.canvas.zoomToPoint(new Point(p.x, p.y), z)
    this.autoFit = false
    this.clampPan()
    this.cb.onZoom(z, this.fitZoom)
  }

  zoomBy(factor: number, at?: { x: number; y: number }) {
    this.zoomTo(this.canvas.getZoom() * factor, at)
  }

  private panBy(dx: number, dy: number) {
    const v = [...this.canvas.viewportTransform] as typeof this.canvas.viewportTransform
    v[4] += dx
    v[5] += dy
    this.canvas.setViewportTransform(v)
    this.autoFit = false
    this.clampPan()
  }

  /** Keep at least part of the card on screen. */
  private clampPan() {
    const v = [...this.canvas.viewportTransform] as typeof this.canvas.viewportTransform
    const z = v[0]
    const { width: W, height: H } = this.canvas.page
    const keep = 80
    v[4] = Math.min(this.canvas.width - keep, Math.max(keep - W * z, v[4]))
    v[5] = Math.min(this.canvas.height - keep, Math.max(keep - H * z, v[5]))
    this.canvas.setViewportTransform(v)
  }

  /** Visible centre of the card in card coordinates. */
  private visibleCentre(): Point {
    const c = new Point(this.canvas.width / 2, this.canvas.height / 2).transform(util.invertTransform(this.canvas.viewportTransform))
    const { width: W, height: H } = this.canvas.page
    return new Point(Math.min(W * 0.9, Math.max(W * 0.1, c.x)), Math.min(H * 0.9, Math.max(H * 0.1, c.y)))
  }

  // ---- objects --------------------------------------------------------------

  private unit() {
    return Math.min(this.page.width, this.page.height) / 1080
  }

  /** Add a text: a free heading/body text or a recipe field. */
  async addText(kind: 'heading' | 'body' | { field: string }) {
    const s = this.unit()
    const W = this.page.width
    let props: Partial<CardText> & { text: string }
    if (kind === 'heading') {
      props = { text: 'Your heading', fontFamily: 'Fraunces', fontSize: 80 * s, fontWeight: boldWeight('Fraunces'), textAlign: 'center', name: 'Heading' }
    } else if (kind === 'body') {
      props = { text: 'Write something here', fontFamily: DEFAULT_FONT, fontSize: 34 * s, textAlign: 'left', lineHeight: 1.35, name: 'Text' }
    } else {
      const field = getField(kind.field)
      const key = field?.key ?? kind.field
      const list = !!field?.list
      props =
        key === 'name'
          ? { text: token(key), fontFamily: 'Fraunces', fontSize: 88 * s, fontWeight: boldWeight('Fraunces'), textAlign: 'center', lineHeight: 1.05 }
          : list
            ? { text: token(key), fontFamily: DEFAULT_FONT, fontSize: 30 * s, lineHeight: 1.4, listStyle: defaultListStyle(key), maxHeight: this.page.height * 0.4 }
            : { text: token(key), fontFamily: DEFAULT_FONT, fontSize: 34 * s, textAlign: key === 'description' ? 'center' : 'left', lineHeight: 1.3 }
      props.name = field?.label ?? key
    }
    await ensureFonts([{ family: props.fontFamily!, weight: props.fontWeight as number }])
    const c = this.visibleCentre()
    const width = kind === 'body' || (typeof kind === 'object' && props.listStyle) ? W * 0.7 : W * 0.8
    const t = new Textbox(props.text, {
      ...props,
      fill: '#2b221b',
      width,
      originX: 'center',
      originY: 'top',
      left: c.x,
      top: c.y - (props.fontSize ?? 30) / 2,
    }) as CardText
    t.sourceText = props.text
    t.baseFontSize = props.fontSize
    if (props.maxHeight) t.maxHeight = props.maxHeight
    if (props.listStyle) t.listStyle = props.listStyle
    t.name = props.name
    applyText(t, this.ctx, { placeholders: true })
    this.canvas.add(t)
    this.canvas.setActiveObject(t)
    this.canvas.requestRenderAll()
    this.emitSelection()
    return t
  }

  /** Apply edits from the property panels to the selected object. */
  async updateActive(patch: Partial<Omit<TextSnapshot, 'kind'>> & Partial<Pick<ShapeSnapshot, 'height'>>) {
    const o = this.canvas.getActiveObject()
    if (!o || o.type === 'activeselection') return
    const set: Record<string, unknown> = {}
    if (patch.fill !== undefined) set.fill = patch.fill
    if (patch.opacity !== undefined) set.opacity = patch.opacity
    if (patch.angle !== undefined) o.rotate(patch.angle)
    if (patch.name !== undefined) set.name = patch.name
    if (isCardText(o)) {
      const family = patch.fontFamily ?? o.fontFamily
      if (patch.fontFamily !== undefined || patch.bold !== undefined) {
        const bold = patch.bold ?? Number(o.fontWeight) >= 600
        set.fontFamily = family
        set.fontWeight = bold ? boldWeight(family) : 400
      }
      if (patch.italic !== undefined) set.fontStyle = patch.italic ? 'italic' : 'normal'
      await ensureFonts([{ family, weight: (set.fontWeight ?? o.fontWeight) as number, style: (set.fontStyle ?? o.fontStyle) as string }])
      if (patch.fontSize !== undefined) o.baseFontSize = Math.max(4, patch.fontSize)
      if (patch.textAlign !== undefined) set.textAlign = patch.textAlign
      if (patch.charSpacing !== undefined) set.charSpacing = patch.charSpacing
      if (patch.lineHeight !== undefined) set.lineHeight = patch.lineHeight
      if (patch.width !== undefined) set.width = Math.max(20, patch.width)
      if (patch.sourceText !== undefined) o.sourceText = patch.sourceText
      if ('listStyle' in patch) o.listStyle = patch.listStyle
      if ('maxHeight' in patch) o.maxHeight = patch.maxHeight && patch.maxHeight > 0 ? patch.maxHeight : undefined
      o.set(set)
      applyText(o, this.ctx, { placeholders: true })
    } else {
      if (patch.width !== undefined) set.width = Math.max(1, patch.width / (o.scaleX || 1))
      if (patch.height !== undefined) set.height = Math.max(1, patch.height / (o.scaleY || 1))
      o.set(set)
    }
    if (patch.x !== undefined || patch.y !== undefined) {
      const tl = o.getPointByOrigin('left', 'top')
      o.setPositionByOrigin(new Point(patch.x ?? tl.x, patch.y ?? tl.y), 'left', 'top')
    }
    o.setCoords()
    this.canvas.requestRenderAll()
    this.changed()
    this.emitSelection()
  }

  async duplicateActive() {
    const o = this.canvas.getActiveObject()
    if (!o || o.type === 'activeselection') return
    const copy = await o.clone([...CUSTOM_PROPS])
    const off = 24 * this.unit()
    copy.set({ left: o.left + off, top: o.top + off })
    if (isCardText(copy)) applyText(copy, this.ctx, { placeholders: true })
    this.canvas.add(copy)
    this.canvas.setActiveObject(copy)
    this.canvas.requestRenderAll()
    this.emitSelection()
  }

  deleteActive() {
    const objs = this.canvas.getActiveObjects()
    if (!objs.length) return
    this.canvas.discardActiveObject()
    this.canvas.remove(...objs)
    this.canvas.requestRenderAll()
    this.emitSelection()
  }

  deselect() {
    this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
    this.emitSelection()
  }

  // ---- events ---------------------------------------------------------------

  private changed() {
    if (!this.loading) this.cb.onChange()
  }

  private frame = 0
  emitSelection() {
    cancelAnimationFrame(this.frame)
    this.frame = requestAnimationFrame(() => this.cb.onSelection(this.snapshot()))
  }

  snapshot(): SelectionSnapshot {
    const objs = this.canvas.getActiveObjects()
    if (!objs.length) return null
    if (objs.length > 1) return { kind: 'multi', count: objs.length }
    const o = objs[0]
    const tl = o.getPointByOrigin('left', 'top')
    const common = {
      name: (o as CardText).name ?? '',
      angle: Math.round(o.angle ?? 0),
      opacity: o.opacity ?? 1,
      x: Math.round(tl.x),
      y: Math.round(tl.y),
    }
    if (isCardText(o)) {
      return {
        kind: 'text',
        ...common,
        sourceText: o.sourceText ?? o.text,
        fontFamily: o.fontFamily,
        fontSize: Math.round(o.baseFontSize ?? o.fontSize),
        bold: Number(o.fontWeight) >= 600 || o.fontWeight === 'bold',
        italic: o.fontStyle === 'italic',
        fill: typeof o.fill === 'string' ? o.fill : '#000000',
        textAlign: o.textAlign,
        charSpacing: o.charSpacing,
        lineHeight: o.lineHeight,
        width: Math.round(o.width),
        listStyle: o.listStyle,
        hasList: /\{\{\s*recipe\.(ingredients|steps|method|instructions)\s*\}\}/.test(o.sourceText ?? ''),
        maxHeight: o.maxHeight ? Math.round(o.maxHeight) : undefined,
        shrunk: (o.baseFontSize ?? o.fontSize) - o.fontSize > 0.5,
        overflow: !!o.overflow,
      }
    }
    return {
      kind: 'shape',
      ...common,
      fill: typeof o.fill === 'string' ? o.fill : '#000000',
      width: Math.round(o.getScaledWidth()),
      height: Math.round(o.getScaledHeight()),
    }
  }

  private bindEvents() {
    const c = this.canvas
    c.on('object:added', () => this.changed())
    c.on('object:removed', () => this.changed())
    c.on('object:modified', ({ target }) => {
      // Corner-scaling text changes its size, not a stretch factor.
      if (isCardText(target) && (target.scaleX !== 1 || target.scaleY !== 1)) {
        const k = target.scaleY
        target.set({ width: target.width * target.scaleX, scaleX: 1, scaleY: 1 })
        target.baseFontSize = (target.baseFontSize ?? target.fontSize) * k
        if (target.maxHeight) target.maxHeight *= k
        applyText(target, this.ctx, { placeholders: true })
      } else if (target instanceof Rect && (target.scaleX !== 1 || target.scaleY !== 1)) {
        target.set({ width: target.width * target.scaleX, height: target.height * target.scaleY, scaleX: 1, scaleY: 1 })
        target.setCoords()
      }
      this.changed()
      this.emitSelection()
    })
    c.on('object:resizing', ({ target }) => {
      if (isCardText(target)) applyText(target, this.ctx, { placeholders: true })
    })
    c.on('object:moving', ({ target }) => {
      const g = c.grid
      if (g.snap) {
        const W = this.page.width
        const snap = (n: number) => Math.round(n / g.size) * g.size
        let x = snap(target.left)
        if (Math.abs(target.left - W / 2) < g.size / 2) x = W / 2
        target.set({ left: x, top: snap(target.top) })
      }
      this.emitSelection()
    })
    c.on('object:scaling', () => this.emitSelection())
    c.on('object:rotating', () => this.emitSelection())
    c.on('selection:created', () => this.emitSelection())
    c.on('selection:updated', () => this.emitSelection())
    c.on('selection:cleared', () => this.emitSelection())
    c.on('mouse:dblclick', ({ target }) => {
      if (isCardText(target)) this.cb.onEditText?.()
    })

    // Panning: one finger on empty card space, space + drag, or middle button.
    c.on('mouse:down:before', ({ e }: TPointerEventInfo) => {
      const touch = 'touches' in e || (e as PointerEvent).pointerType === 'touch'
      const middle = (e as MouseEvent).button === 1
      c.selection = !touch && !this.spaceDown
      if (this.spaceDown || middle) {
        c.skipTargetFind = true
      }
    })
    c.on('mouse:down', ({ e, target }: TPointerEventInfo & { target?: FabricObject }) => {
      const touch = 'touches' in e || (e as PointerEvent).pointerType === 'touch'
      if ((!target && touch) || this.spaceDown || (e as MouseEvent).button === 1) {
        const p = c.getViewportPoint(e)
        this.pan = { x: p.x, y: p.y }
      }
    })
    c.on('mouse:move', ({ e }) => {
      if (!this.pan || this.pinch) return
      const p = c.getViewportPoint(e)
      this.panBy(p.x - this.pan.x, p.y - this.pan.y)
      this.pan = { x: p.x, y: p.y }
      c.requestRenderAll()
    })
    c.on('mouse:up', () => {
      this.pan = undefined
      c.skipTargetFind = false
      c.selection = true
    })
    c.on('mouse:wheel', ({ e }) => {
      const we = e as WheelEvent
      we.preventDefault()
      we.stopPropagation()
      const p = c.getViewportPoint(we)
      if (we.ctrlKey || we.metaKey) this.zoomBy(Math.exp(-we.deltaY * 0.01), p)
      else this.panBy(-we.deltaX, -we.deltaY)
      c.requestRenderAll()
    })

    // Two-finger pinch zoom and pan, handled before Fabric sees the touches.
    const host = this.host
    const pt = (t: Touch) => {
      const r = host.getBoundingClientRect()
      return { x: t.clientX - r.left, y: t.clientY - r.top }
    }
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        if (this.pinch && e.type !== 'touchmove') this.pinch = undefined
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const a = pt(e.touches[0])
      const b = pt(e.touches[1])
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (!this.pinch || e.type === 'touchstart') {
        this.pan = undefined
        this.pinch = { dist, mid, zoom: c.getZoom() }
        return
      }
      this.panBy(mid.x - this.pinch.mid.x, mid.y - this.pinch.mid.y)
      this.zoomTo(this.pinch.zoom * (dist / this.pinch.dist), mid)
      this.pinch.mid = mid
      c.requestRenderAll()
    }
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) {
      host.addEventListener(type, onTouch, { capture: true, passive: false })
      this.disposers.push(() => host.removeEventListener(type, onTouch, { capture: true }))
    }
    // Stop iOS page zoom from pinches on the editor.
    const prevent = (e: Event) => e.preventDefault()
    host.addEventListener('gesturestart', prevent)
    this.disposers.push(() => host.removeEventListener('gesturestart', prevent))

    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if (typing) return
      if (e.code === 'Space') {
        this.spaceDown = e.type === 'keydown'
        c.defaultCursor = this.spaceDown ? 'grab' : 'default'
        if (this.spaceDown) e.preventDefault()
        return
      }
      if (e.type !== 'keydown') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && c.getActiveObject()) {
        e.preventDefault()
        this.deleteActive()
      } else if (e.key === 'Escape') this.deselect()
      else if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        void this.duplicateActive()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        this.zoomBy(1.25)
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault()
        this.zoomBy(0.8)
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        this.fit()
      } else if (e.key.startsWith('Arrow') && c.getActiveObject()) {
        e.preventDefault()
        const o = c.getActiveObject()!
        const step = e.shiftKey ? 10 : 1
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0]
        o.set({ left: o.left + d[0], top: o.top + d[1] })
        o.setCoords()
        c.requestRenderAll()
        this.changed()
        this.emitSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    this.disposers.push(() => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    })
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.disposers.forEach((d) => d())
    void this.canvas.dispose()
  }
}
