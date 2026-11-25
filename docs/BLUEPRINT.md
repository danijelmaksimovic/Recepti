# My Recipe Book – Technical Blueprint v1.0 (approved 2026-11-25)

Requirements: see `docs/SPEC.md`. This file records *how* they are met.

## 1. Stack
React + TypeScript + Vite + Tailwind CSS · Dexie (IndexedDB) · Fabric.js (current major) · vite-plugin-pwa (Workbox).

Approved small additions (each with a reason):
| Need | Lib | Reason |
|---|---|---|
| Routing | react-router | standard |
| Editor UI state | zustand | selection/tool/zoom/panels outside Fabric |
| Live queries | dexie-react-hooks | reactive lists |
| SVG sanitization | DOMPurify | safe SVG import |
| Pressure strokes | perfect-freehand | sketch pad quality |
| PDF | pdf-lib | exact page sizes, no deps |
| Backup zip | fflate | small, streaming |
| Fonts | @fontsource/* (~12 OFL, woff2) | offline, identical everywhere |
Dev/test: Vitest, fake-indexeddb, Playwright (Chromium + **WebKit** as Safari proxy), eruda (debug builds only).

No backend. Hosting = free static HTTPS host (needed for iPhone PWA install); data never leaves the device.

## 2. Structure
```
src/
  app/        routes, shell, PWA registration, storage.persist()
  ui/         design system (tokens, Button, Sheet, Chip, Card, Toolbar)
  domain/     types, placeholder resolver, ingredient parser, units, formatters
  db/         Dexie schema + migrations, repositories (only Dexie consumers)
  features/
    recipes/ collections/ assets/ editor/ sketch/ export/ backup/ settings/
```
Rules: UI never imports Dexie directly. UUID ids + createdAt/updatedAt on every record (sync-ready; no auto-increment).

## 3. Data model (Dexie)
```ts
recipes:     id, name, description, photoAssetId?, photoAssetIds[],
             ingredients: {id, qty?, unit, name, note?, group?}[],   // embedded, ordered
             steps: {id, text}[], prepMin?, cookMin?, totalOverride?,
             servings?, difficulty, categoryId?, tags[], collectionIds[],
             notes, favorite: 0|1, primaryDesignId?, createdAt, updatedAt
             idx: name, categoryId, *tags, *collectionIds, *photoAssetIds, favorite, createdAt, updatedAt
categories:  id, name, icon, sortOrder, builtIn          // 10 seeded on first run
collections: id, name, coverAssetId?, sortOrder, createdAt
assets:      id, kind (photo|illustration|sticker|background|texture|drawing),
             blob, thumb, mime, width, height, bytes, hash (SHA-256, unique),
             name, tags[], sketchData?, createdAt
designs:     id, recipeId, name, templateId?, preset, width, height,
             canvas (Fabric JSON), assetIds[], thumb, createdAt, updatedAt
             idx: recipeId, *assetIds, updatedAt
templates:   id, name, builtIn, preset, width, height, canvas, assetIds[], thumb, updatedAt
             idx: *assetIds
meta:        key/value (schemaVersion, lastBackupAt, persisted)
```
- Dedup: SHA-256 on import → reuse existing asset.
- Asset safety: `assetIds` recomputed on every design/template save. Delete only when usage across recipes/designs/templates = 0. Recipe delete cascades its designs; photo assets removed only if unreferenced; library assets never auto-removed. "Clean unused assets" in Settings with preview.
- Storage errors: QuotaExceededError handled on every write → toast + link to backup/cleanup. Settings shows `navigator.storage.estimate()` and persistence state.

## 4. Content vs design separation
- Canvas never stores baked recipe text. Text objects keep `sourceText` with tokens (`{{recipe.name}}`, `Serves {{recipe.servings}}`); displayed text resolved at render time.
- Image frames bound to `recipe.photo` / `recipe.photos[n]`; cover-fit + clipPath (rounded corners); crop offset/zoom stored per design.
- List tokens (`{{recipe.ingredients}}`, `{{recipe.steps}}`) have format options (bullets / numbered / qty-first); textbox auto-shrinks to min size, then shows overflow badge.
- Recipe has many designs; one is primary. Design actions: create from template, duplicate, rename, delete, set primary, save as template.
- Applying a template **copies** its JSON into a new design (per-recipe tweaks never touch the template). Also: Reset to template, Update template from this design.
- Templates contain structure/styling/tokens only; literal text stays literal.

## 5. Design Studio (Fabric.js)
- Desktop: left tool rail (Templates · Text · Fields · Photos · Assets · Draw · Background), center canvas, right properties, toggleable layers panel. Mobile/tablet: full canvas, bottom tool bar, property bottom sheets.
- Presets (stored in physical units; editor works in fixed logical px, zoom is view-only):
  Digital 4:5 (1080×1350), 2:3 (1000×1500), 9:16, 1:1 · Print 3×5″, 4×6″, 5×7″, A6, A5 @300 DPI · Pages A4, Letter · custom + orientation toggle.
- Objects: text, image, bound image frame, shapes/lines, groups. Custom props always serialized: `binding`, `assetId`, `locked`, `name`, `sourceText`. JSON carries `version` + migrators.
- Assets in JSON referenced by `assetId` only (never dataURLs); resolved to object URLs on load. Mobile editor uses display-size proxies; export swaps in originals.
- Manipulation: move/resize/rotate/duplicate/delete/lock (still in layers)/z-order/align/distribute; multi-select (marquee on desktop, long-press + tap on touch).
- Text editing on touch via side panel (Fabric's hidden-textarea editing is unreliable on iOS).
- Background: color, generated textures (Fabric Pattern; no licensing), library image, opacity/tint.
- Grid snap + custom smart guides (center/edges/other objects) — written in-house.
- History: debounced JSON snapshots, 50 steps. Autosave ~1 s idle + thumbnail regeneration.
- Zoom: fit, 25–400 %, wheel/trackpad, pinch/pan (custom; `touch-action: none` on canvas).
- Always `await document.fonts.load(...)` before rendering text.

## 6. Assets & sketch pad
- Import: multi-file picker, drag-drop, paste. Raster (PNG/JPG/WebP) decoded in a Web Worker (createImageBitmap/OffscreenCanvas): photos downscaled to ≤2560 px; illustrations keep size + alpha; thumbnail generated.
- SVG: DOMPurify (strip script, foreignObject, external href, on* handlers) → Fabric vector; if parse fails, offer rasterize to high-res PNG.
- HEIC: iOS picker usually transcodes to JPEG; on desktop give a clear unsupported-format message.
- Library: filter by kind, tags, search, usage count.
- Sketch pad: separate full-screen module (raw Canvas 2D + Pointer Events + perfect-freehand; pressure where reported). Brushes, colors, eraser (destination-out), undo/redo. Strokes saved as `sketchData` (re-editable); Done → transparent PNG asset placed on card.

## 7. Export
- Re-render via offscreen Fabric StaticCanvas from the design JSON at target size (e.g. 4×6″@300 DPI = 1800×1200), originals + loaded fonts. Not a screenshot.
- PNG (alpha preserved). PDF via pdf-lib: exact page size, 300 DPI image (text not selectable; vector PDF is post-MVP).
- Web Share API with files where supported (iPhone → Save Image), else download. Print view with `@page` size.
- Respect iOS canvas area/memory limits; release temp canvases immediately.

## 8. Backup / restore
- `.recipebook` (zip, streamed via fflate): `manifest.json` (format, schemaVersion, appVersion, exportedAt, counts), `data/<table>.json`, `assets/<id>.<ext>` (originals).
- Restore: validate manifest/version → **Replace all** or **Merge** (by id; assets by hash; newer `updatedAt` wins), batched transactions with progress.
- "Last backup N days ago" nudge after 14 days. UI states plainly that devices do not sync.

## 9. iPhone / tablet
- Installed PWA and Safari tab have **separate storage** → install guide + in-tab warning. `navigator.storage.persist()`; backups are the real safety net.
- Safe areas (`viewport-fit=cover`, `env(safe-area-inset-*)`), `100dvh`.
- Inputs ≥16 px (no zoom), `visualViewport` to lift sheets above keyboard, hide canvas toolbar while typing.
- Manifest, icons incl. apple-touch-icon, status-bar style, standalone mode.
- Bigger touch handles on coarse pointers. No Mac → test with Playwright WebKit + real iPhone on hosted preview; eruda console in debug builds.

## 10. Screens
Home (header, search, Favorites / Recent / Collections rows, category chips, sort, masonry grid of primary-design thumbs or photos, FAB) · Recipe detail (hero, chips, ingredients, steps, notes, designs strip, ⋯ menu) · Recipe form (single scroll, one-line ingredient quick entry, drag reorder incl. touch) · Design Studio · Library · Settings (backup/restore, storage, categories, install guide).

## 11. Starter templates (7)
Minimalist · Vintage Cookbook · Modern Editorial · Rustic Kitchen · Scrapbook · Elegant Handwritten · Colorful Playful — bundled fonts, in-house SVG ornaments, bound fields.

## 12. MVP
In: SPEC §4–§10. Post-MVP: vector PDF, custom font upload, photo filters, SPEC §12.

## 13. Phases
| # | Scope | Verification |
|---|---|---|
| 1 | Blueprint + PROJECT_STATE.md | approved ✅ |
| 2 | Design system, navigation, PWA shell + static deploy | build, installs on iPhone |
| 3 | Dexie schema, repositories, asset store (hash, refs), persist(), error handling | Vitest + fake-indexeddb |
| 4 | Recipe CRUD/duplicate, reorder, categories, collections, search/filter/sort, favorites | component tests + iPhone |
| 5 | Studio foundations: presets, background, zoom, grid, text, fields, design save/load | Playwright (Chromium + WebKit) |
| 6 | Asset import (PNG/JPG/SVG), library, photos (crop, rounded, background) | tests + transparent PNG check |
| 7 | Manipulation, layers, lock, align, multi-select, undo/redo, smart guides, sketch pad | Playwright + stylus check |
| 8 | 7 templates, save-as-template, multiple designs, duplicate/apply | tests + visual review |
| 9 | PNG/PDF export, share, backup/restore | export parity; backup round-trip test |
| 10 | Mobile polish, offline tests, perf, a11y | Lighthouse + device passes |
