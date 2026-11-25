// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeSvg } from '../svg'

describe('SVG sanitising', () => {
  it('removes scripts, event handlers, foreignObject and external links', () => {
    const { text } = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" onload="alert(1)">
      <script>alert(2)</script>
      <foreignObject><div>hi</div></foreignObject>
      <a href="https://evil.example"><circle r="5" onclick="alert(3)"/></a>
      <image href="https://tracker.example/p.png"/>
      <use href="#leaf"/>
      <path id="leaf" d="M0 0L10 10" fill="green"/>
    </svg>`)
    expect(text).not.toMatch(/script|alert|onload|onclick|foreignObject|evil\.example|tracker\.example/i)
    expect(text).toContain('href="#leaf"')
    expect(text).toContain('<path')
  })

  it('gives the drawing a viewBox and a large intrinsic size', () => {
    const icon = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><rect width="24" height="12"/></svg>')
    expect([icon.width, icon.height]).toEqual([1024, 512])
    expect(icon.text).toContain('viewBox="0 0 24 12"')
    const vb = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1000"/>')
    expect([vb.width, vb.height]).toEqual([2000, 1000])
  })

  it('rejects files that are not SVG', () => {
    expect(() => sanitizeSvg('<html><body>nope</body></html>')).toThrow(/could not be read/)
  })
})
