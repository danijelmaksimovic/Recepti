/**
 * The starting layout for a new card: recipe fields placed and styled so a
 * fresh design already shows the recipe. Pure data (Fabric object JSON with
 * centre origins), scaled to the card size.
 */
import type { CardObjectJSON } from './doc'
import { token } from './tokens'

const INK = '#2b221b'
const ACCENT = '#b5532f'
const MUTED = '#6b5b4d'

interface TextOpts {
  name: string
  sourceText: string
  cx: number
  top: number
  width: number
  fontFamily: string
  fontSize: number
  fontWeight?: number
  fontStyle?: 'normal' | 'italic'
  fill?: string
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  charSpacing?: number
  listStyle?: string
  maxHeight?: number
  originY?: 'top' | 'bottom'
}

/** A Textbox JSON whose top (or bottom) edge sits at `top`. */
function text(o: TextOpts): CardObjectJSON {
  const lineHeight = o.lineHeight ?? 1.25
  return {
    type: 'Textbox',
    version: '7',
    originX: 'center',
    originY: o.originY ?? 'top',
    left: o.cx,
    top: o.top,
    width: o.width,
    text: o.sourceText,
    sourceText: o.sourceText,
    name: o.name,
    fontFamily: o.fontFamily,
    fontSize: o.fontSize,
    fontWeight: o.fontWeight ?? 400,
    fontStyle: o.fontStyle ?? 'normal',
    fill: o.fill ?? INK,
    textAlign: o.textAlign ?? 'left',
    lineHeight,
    charSpacing: o.charSpacing ?? 0,
    ...(o.listStyle ? { listStyle: o.listStyle } : {}),
    baseFontSize: o.fontSize,
    ...(o.maxHeight ? { maxHeight: o.maxHeight } : {}),
  }
}

function rule(name: string, cx: number, top: number, width: number, h: number): CardObjectJSON {
  return { type: 'Rect', version: '7', originX: 'center', originY: 'top', left: cx, top, width, height: h, fill: ACCENT, strokeWidth: 0, name }
}

export function starterLayout(width: number, height: number): CardObjectJSON[] {
  const s = Math.min(width, height) / 1080
  const pad = Math.round(width * 0.08)
  const cx = width / 2
  const inner = width - pad * 2
  const out: CardObjectJSON[] = []
  let y = Math.round(height * 0.07)

  // The name is anchored at its bottom edge: long names wrap upward (then
  // shrink), so the description below never gets covered.
  const nameSize = 88 * s
  const nameBox = nameSize * 1.05 * 2 + 4
  y += nameBox
  out.push(
    text({ name: 'Recipe name', sourceText: token('name'), cx, top: y, originY: 'bottom', width: inner, fontFamily: 'Fraunces', fontSize: nameSize, fontWeight: 600, textAlign: 'center', lineHeight: 1.05, maxHeight: nameBox }),
  )
  y += 28 * s
  const descSize = 34 * s
  const descBox = descSize * 1.3 * 2 + 4
  out.push(
    text({ name: 'Description', sourceText: token('description'), cx, top: y, width: inner * 0.9, fontFamily: 'Lora', fontSize: descSize, fontStyle: 'italic', fill: MUTED, textAlign: 'center', lineHeight: 1.3, maxHeight: descBox }),
  )
  y += descBox + 30 * s
  out.push(
    text({
      name: 'Category, time and servings',
      sourceText: `${token('category')}  ·  ${token('totalTime')}  ·  Serves ${token('servings')}`,
      cx,
      top: y,
      width: inner,
      fontFamily: 'Inter Variable',
      fontSize: 26 * s,
      fill: MUTED,
      textAlign: 'center',
      charSpacing: 80,
    }),
  )
  y += 26 * s * 2.4
  out.push(rule('Divider', cx, y, 120 * s, Math.max(2, 4 * s)))
  y += 60 * s

  const bottom = height - pad
  const headSize = 40 * s
  const bodySize = 30 * s
  const head = (name: string, label: string, x: number, top: number, w: number) =>
    text({ name, sourceText: label, cx: x, top, width: w, fontFamily: 'Fraunces', fontSize: headSize, fontWeight: 600, fill: ACCENT })

  if (width > height * 1.1) {
    // Landscape: two columns.
    const gap = pad * 0.6
    const colW = (inner - gap) / 2
    const lx = pad + colW / 2
    const rx = width - pad - colW / 2
    const listTop = y + headSize * 1.6
    out.push(head('Ingredients heading', 'Ingredients', lx, y, colW))
    out.push(head('Method heading', 'Method', rx, y, colW))
    const maxH = bottom - listTop
    out.push(text({ name: 'Ingredients', sourceText: token('ingredients'), cx: lx, top: listTop, width: colW, fontFamily: 'Inter Variable', fontSize: bodySize, lineHeight: 1.4, listStyle: 'bullets', maxHeight: maxH }))
    out.push(text({ name: 'Steps', sourceText: token('steps'), cx: rx, top: listTop, width: colW, fontFamily: 'Inter Variable', fontSize: bodySize, lineHeight: 1.4, listStyle: 'numbered', maxHeight: maxH }))
  } else {
    const gap = 36 * s
    const remaining = bottom - y - headSize * 3.2 - gap
    const ingH = remaining * 0.4
    const stepH = remaining - ingH
    out.push(head('Ingredients heading', 'Ingredients', cx, y, inner))
    y += headSize * 1.6
    out.push(text({ name: 'Ingredients', sourceText: token('ingredients'), cx, top: y, width: inner, fontFamily: 'Inter Variable', fontSize: bodySize, lineHeight: 1.4, listStyle: 'bullets', maxHeight: ingH }))
    y += ingH + gap
    out.push(head('Method heading', 'Method', cx, y, inner))
    y += headSize * 1.6
    out.push(text({ name: 'Steps', sourceText: token('steps'), cx, top: y, width: inner, fontFamily: 'Inter Variable', fontSize: bodySize, lineHeight: 1.4, listStyle: 'numbered', maxHeight: stepH }))
  }
  return out
}
