// Renders PWA / Apple icons from public/favicon.svg. Run: npm run icons
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

const svg = await readFile('public/favicon.svg')
// Full-bleed square for iOS (it applies its own rounded mask) and maskable icons.
const square = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"'))
// Maskable: shrink artwork into the 80% safe zone on a solid background.
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#b5532f"/>` +
    `<g transform="translate(51.2 51.2) scale(0.8)">${square.toString().replace(/<\/?svg[^>]*>/g, '')}</g></svg>`,
)

await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(maskable).resize(512, 512).png().toFile('public/pwa-maskable-512.png')
await sharp(square).resize(180, 180).png().toFile('public/apple-touch-icon.png')
console.log('icons written')
