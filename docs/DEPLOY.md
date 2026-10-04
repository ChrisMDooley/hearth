# Going live on Cloudflare

**Live:** https://hearth.christopher-m-dooley.workers.dev (Access team `lively-pine-edcd`, policy `Family`)

Everything here is on Cloudflare's free plans. Zero Trust and R2 ask for a card
on file; the free tiers aren't charged.

## Chris (one time, ~20 minutes)

1. **Cloudflare account** — dash.cloudflare.com/sign-up, confirm email, turn on two-factor.
2. **GitHub** — create an empty private repository `hearth`; Claude pushes the code.
3. **Worker** — Workers & Pages → Create → connect Git → `hearth`.
   Build command `npm run build`, deploy command `npx wrangler deploy` (the defaults).
   The app lives at `hearth.<your-subdomain>.workers.dev`.
4. **Storage** — Storage & Databases: D1 database `hearth`, R2 bucket `hearth-photos`.
   Put the D1 database ID into `wrangler.toml` (Claude does this once you send it).
5. **Login** — Zero Trust → choose a team name → Free plan. Then the `hearth` Worker →
   **Access** tab → turn it on for the workers.dev address and allow the family's emails.
   Login method: one-time PIN (a code by email).
6. Optional, recommended: copy the Access application's AUD tag and team domain into
   `wrangler.toml` `[vars]` so the server also checks the signed login token.

## First use

- The first person to open the app fills the shared library with the sample
  recipes and the Sourdough Kitchen.
- Everyone picks their profile once ("Who's this?").
- Add to home screen: Safari → Share → Add to Home Screen; Chrome → ⋮ → Install app.

## Local development

```bash
npm install
npm run dev                         # device-only mode, no server
npm run build && npx wrangler dev --var DEV_EMAIL:you@example.com   # with the API
```
