# PROJECT_STATE

**Project:** My Recipe Book — personal local-first recipe web app / PWA with a Fabric.js recipe card designer.
**Docs:** requirements `docs/SPEC.md` · architecture `docs/BLUEPRINT.md` (v1.0, approved 2026-11-25).

## Key decisions
- Web/PWA (React, TS, Vite, Tailwind, Dexie, Fabric.js, vite-plugin-pwa). Native iOS dropped (no Mac).
- No backend; static HTTPS hosting only for iPhone install. Data stays on device.
- Recipe content and card designs fully separate; templates hold tokens (`{{recipe.*}}`), never content. Applying a template copies it into a new per-recipe design. Recipes can have multiple designs, one primary.
- Assets stored once (SHA-256 dedup) as IndexedDB blobs, referenced by `assetId`; deletion only when unreferenced.
- Exports re-rendered offscreen at target DPI from design JSON.
- Backup = streamed `.recipebook` zip; restore Replace or Merge.
- Sketch pad is a separate module, not a mode of the main editor.

## Progress
- [x] Phase 1 – Architecture & blueprint
- [x] Phase 2 – Design system, navigation, PWA shell (done, 2026-11-25) · live on GitHub Pages, installs on iPhone
- [x] Phase 3 – Storage & data models (done, 2026-11-25)
- [x] Phase 4 – Recipe management (screens wired to Dexie; awaiting review)
- [ ] Phase 5 – Card Designer foundations
- [ ] Phase 6 – Asset import & library
- [ ] Phase 7 – Manipulation, layers, sketch pad
- [ ] Phase 8 – Templates & reusable designs
- [ ] Phase 9 – Export, backup, restore
- [ ] Phase 10 – PWA/mobile optimization & testing

## Phase 2 notes
- Vite 8, React 19, react-router 8, Tailwind 4 (`@theme` tokens in `src/index.css`, light + dark), vite-plugin-pwa 2 (prompt-to-update).
- Fonts: Fraunces (display) + Inter Variable (UI), bundled via @fontsource and precached.
- Nav: bottom tab bar (Cookbook · Studio · + · Library · Settings) on phone/tablet, left rail on desktop (`lg`).
- iOS: safe areas, 16px inputs, apple-touch-icon, in-tab install hint, persist() when standalone.
- `/settings/design` is a living design-system reference.
- Playwright WebKit is not installed in the cloud container; checks ran in Chromium with iPhone emulation.

## Phase 3 notes
- `src/db`: Dexie schema v1 (`schema.ts`), repositories in `repos/`, public API via `@/db`. UI must import from `@/db`, never Dexie.
- Timestamps are ms since epoch. Built-in categories use stable ids `builtin-<name>` so backups merge across devices; they can be renamed, not deleted.
- Assets: SHA-256 dedup on `addAsset`; `countAssetUsage` covers recipe photos, design/template `assetIds` (recomputed from canvas JSON on every save) and collection covers. Only `photo` assets are auto-removed (on recipe delete or photo removal) and only when unused.
- First design becomes primary; deleting the primary hands it to the most recently edited one. Templates are copied into designs.
- Writes go through `guardWrite`: quota errors become `StorageFullError`, and `onStorageError` listeners can show a toast (wired in Phase 4).
- Tests: `npm test` (Vitest + fake-indexeddb). CI runs tests + build on PRs; deploy runs tests before building.
- Schema changes: add a new `this.version(n)` block; never edit a published one.

## Open items
- Hosting: GitHub Pages, deployed by .github/workflows/deploy.yml on push to main.
- Tablet used for drawing (iPad / Android / Windows) → stylus test target.

## Phase 4 notes
- Screens: Home (search, category/favorite chips, sort, Favorites + Collections rows, masonry grid), Recipe detail (tick-off ingredients, ⋯ menu: edit/duplicate/collections/delete), Recipe form (`/recipes/new`, `/recipes/:id/edit`), Collection page, Settings › Categories & collections.
- One-line ingredient entry parsed by `src/domain/ingredients.ts`; a line ending in ":" starts a group.
- Drag reorder (`ui/Sortable`) uses Pointer Events and only shifts rows visually until release; grip also takes ArrowUp/Down.
- Main photo: downscaled to 2560 px + 720 px thumb on the main thread (moves to a worker in Phase 6).
- Component tests: Testing Library + jsdom (`// @vitest-environment jsdom`), helper `src/test/render.tsx`.
- `Button`/`Chip` default to `type="button"` so sheets inside forms never submit them.
