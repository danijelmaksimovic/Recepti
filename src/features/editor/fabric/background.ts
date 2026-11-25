/**
 * Card background painting shared by the editor and the offscreen renderer:
 * a solid colour plus an optional generated texture (no image licensing).
 */
import type { CardBackground } from '@/domain/card/doc'

/** Small deterministic PRNG so paper grain looks the same on every render. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const tileCache = new Map<string, HTMLCanvasElement>()

/**
 * A transparent tile holding just the texture marks, sized in card px.
 * `unit` scales the pattern with the card so it looks alike on any preset.
 */
export function textureTile(bg: CardBackground, unit: number): HTMLCanvasElement | undefined {
  if (bg.texture === 'none' || bg.textureOpacity <= 0) return undefined
  const u = unit * bg.textureScale
  const key = `${bg.texture}|${bg.textureColor}|${bg.textureOpacity}|${u.toFixed(3)}`
  const hit = tileCache.get(key)
  if (hit) return hit

  const size = (n: number) => Math.max(2, Math.round(n * u))
  const sizes: Record<string, number> = { dots: size(28), grid: size(40), lines: size(46), diagonal: size(28), gingham: size(48), paper: 256, linen: 128 }
  const s = sizes[bg.texture]
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = g.strokeStyle = bg.textureColor
  g.globalAlpha = bg.textureOpacity

  switch (bg.texture) {
    case 'dots':
      g.beginPath()
      g.arc(s / 2, s / 2, Math.max(0.8, 2.4 * u), 0, Math.PI * 2)
      g.fill()
      break
    case 'grid':
      g.lineWidth = Math.max(0.6, 1.2 * u)
      g.beginPath()
      g.moveTo(0, 0.5)
      g.lineTo(s, 0.5)
      g.moveTo(0.5, 0)
      g.lineTo(0.5, s)
      g.stroke()
      break
    case 'lines':
      g.lineWidth = Math.max(0.6, 1.4 * u)
      g.beginPath()
      g.moveTo(0, s - 1)
      g.lineTo(s, s - 1)
      g.stroke()
      break
    case 'diagonal':
      g.lineWidth = s * 0.25
      g.beginPath()
      for (const o of [-s, 0, s]) {
        g.moveTo(o, s)
        g.lineTo(o + s, 0)
      }
      g.stroke()
      break
    case 'gingham':
      g.globalAlpha = bg.textureOpacity * 0.6
      g.fillRect(0, 0, s / 2, s)
      g.fillRect(0, 0, s, s / 2)
      break
    case 'paper': {
      const r = rng(7)
      for (let i = 0; i < 900; i++) {
        g.globalAlpha = bg.textureOpacity * (0.15 + r() * 0.5)
        const d = 0.6 + r() * 1.4
        g.fillRect(r() * s, r() * s, d, d)
      }
      g.lineWidth = 0.6
      for (let i = 0; i < 26; i++) {
        g.globalAlpha = bg.textureOpacity * 0.35 * r()
        const x = r() * s
        const y = r() * s
        const a = r() * Math.PI
        const l = 6 + r() * 18
        g.beginPath()
        g.moveTo(x, y)
        g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l)
        g.stroke()
      }
      break
    }
    case 'linen': {
      const r = rng(11)
      g.lineWidth = 0.7
      for (let y = 0; y < s; y += 2) {
        g.globalAlpha = bg.textureOpacity * (0.1 + r() * 0.45)
        g.beginPath()
        g.moveTo(0, y + 0.5)
        g.lineTo(s, y + 0.5)
        g.stroke()
      }
      for (let x = 0; x < s; x += 2) {
        g.globalAlpha = bg.textureOpacity * (0.08 + r() * 0.35)
        g.beginPath()
        g.moveTo(x + 0.5, 0)
        g.lineTo(x + 0.5, s)
        g.stroke()
      }
      break
    }
  }
  if (tileCache.size > 24) tileCache.clear()
  tileCache.set(key, c)
  return c
}

export interface PageSpec {
  width: number
  height: number
  background: CardBackground
}

/** Texture scale unit for a card: 1 at 1080 px on the short side. */
export function pageUnit(page: Pick<PageSpec, 'width' | 'height'>): number {
  return Math.min(page.width, page.height) / 1080
}

/**
 * Paint the card rectangle (in card coordinates) under the given viewport
 * transform. Used by both canvases' background hook.
 */
export function paintPage(ctx: CanvasRenderingContext2D, vpt: number[], page: PageSpec, shadow?: { color: string; blur: number }) {
  ctx.save()
  ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])
  if (shadow) {
    ctx.shadowColor = shadow.color
    ctx.shadowBlur = shadow.blur
    ctx.shadowOffsetY = shadow.blur / 4
  }
  ctx.fillStyle = page.background.color
  ctx.fillRect(0, 0, page.width, page.height)
  ctx.shadowColor = 'transparent'
  const tile = textureTile(page.background, pageUnit(page))
  if (tile) {
    const pattern = ctx.createPattern(tile, 'repeat')
    if (pattern) {
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, page.width, page.height)
    }
  }
  ctx.restore()
}
