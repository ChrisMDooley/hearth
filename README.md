# Hearth — our family baking book

A mobile-first PWA for the recipes we actually bake: favourites, family recipes,
recipes saved from creators like Farmhouse on Boone (with credit and a link back),
personal notes, and a journal of every bake.

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # unit tests for parsing, conversion, timers
npm run build          # installable PWA in dist/ (any static host)
npm run build:preview  # one self-contained HTML file in dist-preview/
```

Start here:

- `docs/ARCHITECTURE.md` — stack, folders, data model, measurement rules, decisions
- `docs/schema.sql` — the same model as SQL tables, for when we add a server
- `docs/ROADMAP.md` — what's done, what's next, open decisions

Working name "Hearth" — change it in `index.html`, `vite.config.ts` (manifest) and `.brand` in `App.tsx`.
