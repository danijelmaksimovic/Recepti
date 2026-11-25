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
- [~] Phase 2 – Design system, navigation, PWA shell (done, 2026-11-25) · deploy pending hosting choice
- [ ] Phase 3 – Storage & data models
- [ ] Phase 4 – Recipe management
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

## Open items
- Hosting choice + GitHub repo name (Cloudflare Pages or GitHub Pages).
- Tablet used for drawing (iPad / Android / Windows) → stylus test target.
