# My Recipe Book

Private, offline-first recipe book and card designer (PWA). See `docs/SPEC.md`, `docs/BLUEPRINT.md` and `PROJECT_STATE.md`.

```bash
npm install
npm run dev        # local dev server
npm run build      # type check + production build (dist/)
npm run preview    # serve the production build, incl. service worker
npm run icons      # regenerate PWA icons from public/favicon.svg
```

Deploying under a sub-path (e.g. GitHub Pages): `BASE=/Recepti/ npm run build`.
