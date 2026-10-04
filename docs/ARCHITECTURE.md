# Architecture

## Stack and why

| Choice | Why |
|---|---|
| **Vite + React + TypeScript** | Fast, simple, typed. The app is a client-side PWA with no server yet, so Next.js's server features would add weight without benefit. If we later want server rendering, the `domain/` and `ui/` code moves over unchanged. |
| **IndexedDB (via `idb`)** | All data, including photos, lives on the device. Works offline from day one. |
| **Hash routing** | Hostable on any static host with no rewrite rules. |
| **vite-plugin-pwa** | Manifest + service worker: installable on phones, app shell cached offline. |
| **Plain CSS with tokens** | One stylesheet (`src/styles/app.css`), light/dark tokens, no UI framework. |

## Folders

```
src/
  domain/      Pure logic, no React. Safe to reuse on a server.
    types.ts        the data model (one interface ≈ one future table)
    ingredients.ts  ingredient catalogue with densities (g per US cup)
    units.ts        conversion, scaling display, temperatures
    parse.ts        ingredient-line parser, timer detection, ids
    search.ts       search ("sourdough under 2 hours")
    importers.ts    web page (schema.org JSON-LD) and plain-text → draft recipe
    units.test.ts   unit tests
  data/        Persistence boundary.
    repository.ts   Repository interface + IndexedDB and in-memory implementations
    store.tsx       React context: loads data, exposes actions, current user
    seed.ts         sample library (+ SEED_VERSION merge for existing devices)
    sourdoughKitchen.json/.ts  Chris's 22 Sourdough Kitchen recipes
  ui/          Reusable components (cards, sheet, timers, icons, illustrations, ocr.ts)
  pages/       Screens: Home, Browse, Recipe, CookMode, Creators, Add, Editor, Profile
  styles/      app.css
docs/          this file, schema.sql, ROADMAP.md
functions/api/[[path]].ts  the family server API (Cloudflare Pages Functions: D1 + R2)
wrangler.toml              Cloudflare bindings (DB, PHOTOS)
scripts/copy-ocr-assets.mjs  puts the OCR engine + English/German data in public/ocr
```

Rule of thumb: `pages/` may use everything; `ui/` uses `domain/` and the store;
`domain/` imports nothing from the app.

## Data model

Canonical recipe data and per-user data are kept apart:

- **Canonical:** `Recipe` (with embedded `RecipeIngredient[]` and `Instruction[]`),
  `Creator`, `Collection`, `RecipeCollection`, ingredient catalogue (`IngredientInfo`).
- **Per user:** `User` (incl. unit preference), `Favorite`, `UserRecipeNote`,
  `BakeEntry`, `Photo`.

A bake or a note never edits the recipe. Ingredients/steps are embedded locally
because each belongs to exactly one recipe; `docs/schema.sql` shows them as tables.

### Provenance

`Recipe.kind` = `mine | family | creator | adapted`, plus `creatorId` and
`source { name, url, originalTitle, originalCreator }`.
`Recipe.contentMode` = `full` (we store ingredients + method) or `reference`
(link + our notes and bakes, nothing copied). Recipes from external creators are
stored as **references** by default; "Write down our adapted version" creates a
separate `adapted` recipe that keeps the credit and link.

### Photos

`Photo` records hold the image blob (resized to ≤1600 px JPEG). Recipes point to
one via `heroPhotoId`; bakes via `photoIds`. Without a photo a recipe shows a
drawn illustration (`ui/RecipeArt.tsx`) rather than a creator's image.

## Measurements

- The stored quantity is never changed; conversions are display-only.
- g↔oz and ml↔cups are exact. Cups↔grams use the ingredient's density and are
  shown with **≈** (an extra hint when the density is marked `rough`).
- Teaspoons/tablespoons stay spoons unless scaled up to ≥ ¼ cup.
- In US mode, cups are only used when the fraction is honest (6 tbsp is not "⅓ cup").
- Unknown ingredients fall back to ml (metric) or oz (US).
- The original measure can be shown in brackets (profile setting, on by default).
- A line can carry a second published measure (`altQuantity`), e.g. Lisa's
  "1 cup" next to our 250 g. The reader's system picks which one is shown, exactly,
  and the other appears in brackets — no density guess needed.
- To support a new ingredient, add it to `domain/ingredients.ts`.

## Importing

All routes end in the editor as a draft with a "Check before saving" banner:

| Route | How |
|---|---|
| Link | `/api/import` (or `VITE_IMPORT_PROXY` elsewhere) fetches the page → `recipeFromHtml` reads schema.org Recipe JSON-LD (title, ingredients, steps incl. sections, times, yield, image, author, site). Without the proxy: paste the page text, link kept for credit. |
| Photo / screenshot | Tesseract OCR in the browser (English + German, files served from `/ocr/`, cached after first use) → editable text → `recipeFromText`. |
| Pasted text | `recipeFromText`: uses "Ingredients/Zutaten", "Method/Zubereitung" headings when present, otherwise lines starting with an amount are ingredients; re-joins wrapped lines. |
| Link only | Bookmark with credit, nothing copied. |

Imported creator recipes keep `source` (site, URL, original title, author) and can be
switched to "keep only the link" in the editor. A creator's picture is linked via
`sourceImageUrl` (with a credit), never copied.

## Sample data updates

`SEED_VERSION` in `seed.ts`. When it rises, devices that already have data get the
new sample records merged in (nothing of theirs is overwritten), built-in collection
descriptions filled in, and `RETIRED_SEED_IDS` removed if unused.

## Hosting, login and sync (Cloudflare)

- **App:** Cloudflare Pages, built from GitHub on every push.
- **Login:** Cloudflare Access in front of the whole site (email one-time code).
  The API reads the signed-in email; with `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD` set it
  also verifies Access's signed token.
- **Profiles:** first visit with a new email shows "Who's this?" and links the email
  to a profile (`members` table). After that the login decides who you are.
- **Data:** D1 table `records(store, key, data, owner, seq, deleted)` holds the same
  documents the phone keeps. Each write gets the next `seq`; a device asks for
  "everything after my seq". Deletions are tombstones. The normalised
  `docs/schema.sql` remains the reference if we ever need SQL reporting.
- **Privacy on the server:** notes and favourites are only sent to their owner;
  private recipes and personal collections only to their owner; you can only write
  your own notes, favourites and bakes.
- **Photos:** R2 bucket, `PUT/GET /api/photos/:id`; phones keep their own copy and
  fetch others' on demand.
- **Offline-first (`src/data/sync.ts`):** the phone's IndexedDB stays the source the
  UI reads. Writes go to an outbox and are sent shortly after; pulls happen on start,
  on focus/online and every minute. A record with an unsent local change is never
  overwritten by the server (last write wins otherwise).
- **Sample data on the server:** sent as insert-if-absent, so samples the family
  deleted stay deleted. The server stores the sample-data version.
- Without the server (preview, `npm run dev`) the app runs device-only as before.

## Users without the server

"Who's baking?" on the profile screen switches profiles on this device.

## Limits of v1 (by design)

- In the preview, data lives in that browser only and link import falls back to pasted text.
- Photo import is not available in the single-file preview (artifacts can't serve the
  language data); it works in the real build.
