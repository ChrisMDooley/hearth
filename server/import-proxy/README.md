# Import proxy

Lets "Import from a link" fetch a recipe page. Runs on Cloudflare Workers' free plan
(100,000 requests/day — far beyond a family's needs).

```bash
npm install -g wrangler
wrangler login
# set ALLOWED_ORIGINS in wrangler.toml to the app's address first
wrangler deploy
```

Then build the app with the worker's address:

```bash
VITE_IMPORT_PROXY=https://hearth-import.<your-account>.workers.dev npm run build
```

Without `VITE_IMPORT_PROXY` the app still works: link import falls back to
"paste the recipe text", and "Save a link" bookmarks need no proxy at all.
