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
    units.test.ts   unit tests
  data/        Persistence boundary.
    repository.ts   Repository interface + IndexedDB and in-memory implementations
    store.tsx       React context: loads data, exposes actions, current user
    seed.ts         sample library
  ui/          Reusable components (cards, sheet, timers, icons, illustrations)
  pages/       Screens: Home, Browse, Recipe, CookMode, Creators, Add, Editor, Profile
  styles/      app.css
docs/          this file, schema.sql, ROADMAP.md
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
- To support a new ingredient, add it to `domain/ingredients.ts`.

## Users (no auth yet)

"Who's baking?" on the profile screen sets the current user on this device.
`store.tsx` is the only place that decides the current user, so real
authentication replaces that one piece.

## Limits of v1 (by design)

- Data lives per device/browser. Phones don't share recipes until we add sync.
- URL import saves a link with attribution; automatic extraction needs a server
  (browsers can't read other sites directly).
- Photo/OCR import is not built yet.
