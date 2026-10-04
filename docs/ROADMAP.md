# Roadmap

## v0.1 — done (4 Oct 2026)

- Mobile-first shell: bottom bar on phones, sidebar on desktop, light/dark
- Home: search, collection chips, Favourites, Recently baked, Farmhouse on Boone shelf
  (the external creator we save most from), Family recipes, Creators, Recently added
- Browse/search across title, ingredients, tags, creator, collections, own notes;
  type filters (Ours / Family / From creators / Adapted); "under 2 hours" style limits
- Recipe page: attribution, times, oven temp, yield stepper ("make 18 instead of 12"),
  ½–3× scale, Metric/US with ≈ for density conversions, tickable ingredients and steps,
  timer buttons from step text, tips, my notes, bake journal with photos and ratings, source
- Baking mode: one step at a time, big text, screen wake lock, swipe, timers, log bake at the end
- Creators: list + attribution pages with link back
- Add: manual editor with paste-a-list parsing; "Save a link" bookmarks with credit
- Profiles without passwords, persistent on-device storage, sample library, unit tests

## Recommended next

1. **Sync between family phones** — needs a backend decision (see below).
2. **URL import** — small server function that reads a recipe page's schema.org data
   and pre-fills the editor for review; creator recipes still default to link + notes.
3. **Photo / screenshot import** — AI/OCR step that turns a cookbook page or Oma's card
   into a draft for review.
4. **Own collections + reorder** — create/rename collections, add from the recipe page.
5. **Shopping list** from one or more recipes (scaled).

## Decisions to make together

- **Hosting + sync backend:** Supabase (Postgres + auth + photo storage, free tier),
  PocketBase (one small self-hosted server), or Firebase. `docs/schema.sql` maps to the first two directly.
- **Accounts:** magic-link email vs. a shared family login with profiles.
- **Copyright policy for imports:** keep creator recipes as links (current default), or
  allow storing full text for private use only.
