# Roadmap

## v0.3 — built, waiting for the Cloudflare account (4 Oct 2026)

- Family server on Cloudflare: login by email (Access), shared library, sync between
  phones that keeps working offline, photos in R2, link import on the server.
- "Who's this?" on first login; sync status on the profile.
- Tested with two simulated phones: shared bakes and photos, private notes stay
  private, deletions stick, new recipes appear on the other phone.

## v0.2 — done (4 Oct 2026)

- **Sourdough Kitchen** (22 recipes adapted from Lisa Bass / Farmhouse on Boone) in the
  library: grams with her cup measures kept exactly, oven conventional + fan, tips,
  hydration and stage timelines. New "Sourdough discard" collection with the
  "discard in the jar" slider; the Farmhouse on Boone creator page now holds 25 recipes.
- **Import:** from a link (schema.org data, needs the proxy), from a photo or screenshot
  (on-device OCR, English + German), from pasted text. Always reviewed before saving.
- **Own collections:** create, rename, describe, delete; "Save to collection" on every recipe.
- Sample-data versioning so existing devices pick up new sample recipes.

## v0.1 — done (4 Oct 2026)

Mobile-first shell, home, search, recipe page with scaling and Metric/US, baking mode,
creators, editor, profiles, notes, bake journal, on-device storage.

## Next

1. **Go live on Cloudflare** — see `docs/DEPLOY.md`.
2. **Recipe-level photo from import:** option to keep the scanned card as Oma's original.
3. **Starter tracker:** feed times and a "ready around…" estimate for the loaves.
4. **Bring! hand-off** (instead of our own shopping list). Bring imports recipes from
   public pages that carry schema.org Recipe data with author, title and ingredients.
   Plan: a public, read-only share page per recipe with that markup and a
   "Send to Bring!" button using Bring's recipe widget. Needs hosting first.

## Hosting options considered (chose Cloudflare)

| | Cost | Good | Watch out |
|---|---|---|---|
| **Cloudflare** (Pages + Workers + D1 + R2, Access for login) | €0 | One account for app, import proxy, data and photos (R2 10 GB). Never pauses. Access free for < 50 users. | Sync API is code we write (small). |
| **Supabase** (+ Cloudflare/Netlify for the app) | €0 | Postgres matching `schema.sql`, built-in login, photo storage, EU region. Least code. | Free projects pause after 7 days without use; 500 MB DB / 1 GB files. Pro is $25/month. |
| **PocketBase** on a home machine or small server | €0 at home, ~€4–5/mo VPS | One small program, login + files + realtime included, data stays with us. | Needs an always-on machine; we look after updates/backups. |
