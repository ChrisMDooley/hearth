/**
 * Hearth API — Cloudflare Pages Functions. Everything under /api/*.
 *
 * Who is calling: the whole site sits behind Cloudflare Access, which logs
 * people in by email and passes the address on. If ACCESS_TEAM_DOMAIN and
 * ACCESS_AUD are set, the signed Access token is verified as well.
 *
 * Routes
 *   GET  /api/me              who am I, which profile is mine, is the library empty
 *   POST /api/claim           link my email to a profile (once)
 *   POST /api/sync            send my changes, receive everyone else's
 *   GET  /api/photos/:id      a photo from R2
 *   PUT  /api/photos/:id      upload a photo
 *   GET  /api/import?url=     fetch a recipe page for link import
 *
 * Data: one `records` table holding the same documents the app keeps on the
 * phone (recipes, notes, bakes …), each with a sequence number so devices can
 * ask "what changed since #n". Deletions are kept as tombstones.
 */

interface Env {
  DB: D1Database
  PHOTOS: R2Bucket
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  /** Local development only: pretend to be this email. */
  DEV_EMAIL?: string
}

type Ctx = EventContext<Env, string, Record<string, unknown>>

const STORES = new Set(['users', 'creators', 'recipes', 'collections', 'recipeCollections', 'favorites', 'notes', 'bakes'])
/** Records only their owner may write and only their owner receives. */
const PRIVATE = new Set(['notes', 'favorites'])
/** Records only their owner may write, but the family sees. */
const OWNED = new Set(['bakes'])

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  try {
    const url = new URL(ctx.request.url)
    const path = url.pathname.replace(/^\/api\/?/, '')
    const email = await identify(ctx)
    if (!email) return json({ error: 'Not signed in' }, 401)
    await ensureSchema(ctx.env.DB)

    const method = ctx.request.method
    if (path === 'me' && method === 'GET') return me(ctx.env, email)
    if (path === 'claim' && method === 'POST') return claim(ctx.env, email, await ctx.request.json())
    if (path === 'sync' && method === 'POST') return sync(ctx.env, email, await ctx.request.json())
    if (path.startsWith('photos/')) return photo(ctx, path.slice(7), email)
    if (path === 'import' && method === 'GET') return importPage(url.searchParams.get('url'))
    return json({ error: 'Not found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: 'Something went wrong on the server' }, 500)
  }
}

// ------------------------------------------------------------------ identity

async function identify(ctx: Ctx): Promise<string | null> {
  const { env, request } = ctx
  if (env.DEV_EMAIL) return env.DEV_EMAIL.toLowerCase()
  const email = request.headers.get('Cf-Access-Authenticated-User-Email')
  if (!email) return null
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? ''
    const claims = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD)
    if (!claims || String(claims.email).toLowerCase() !== email.toLowerCase()) return null
  }
  return email.toLowerCase()
}

let certs: { keys: (JsonWebKey & { kid: string })[]; at: number } | null = null

async function verifyAccessJwt(token: string, team: string, aud: string): Promise<Record<string, unknown> | null> {
  const [h, p, s] = token.split('.')
  if (!h || !p || !s) return null
  const header = JSON.parse(b64urlText(h)) as { kid: string; alg: string }
  if (header.alg !== 'RS256') return null
  if (!certs || Date.now() - certs.at > 3600_000) {
    const res = await fetch(`https://${team.replace(/^https?:\/\//, '')}/cdn-cgi/access/certs`)
    certs = { keys: ((await res.json()) as { keys: (JsonWebKey & { kid: string })[] }).keys, at: Date.now() }
  }
  const jwk = certs.keys.find((k) => k.kid === header.kid)
  if (!jwk) return null
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(s), new TextEncoder().encode(`${h}.${p}`))
  if (!ok) return null
  const claims = JSON.parse(b64urlText(p)) as Record<string, unknown>
  const auds = ([] as unknown[]).concat(claims.aud)
  if (!auds.includes(aud)) return null
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null
  return claims
}

function b64urlBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}
function b64urlText(s: string) {
  return new TextDecoder().decode(b64urlBytes(s))
}

// ------------------------------------------------------------------ schema

let schemaReady = false
async function ensureSchema(db: D1Database) {
  if (schemaReady) return
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS records (
        store TEXT NOT NULL, key TEXT NOT NULL, data TEXT, owner TEXT,
        seq INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
        updated_by TEXT, updated_at TEXT,
        PRIMARY KEY (store, key))`,
    ),
    db.prepare('CREATE INDEX IF NOT EXISTS records_seq ON records(seq)'),
    db.prepare('CREATE TABLE IF NOT EXISTS members (email TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, created_at TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)'),
  ])
  schemaReady = true
}

async function memberId(env: Env, email: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT user_id FROM members WHERE email = ?').bind(email).first<{ user_id: string }>()
  return row?.user_id ?? null
}

// ------------------------------------------------------------------ me / claim

async function me(env: Env, email: string) {
  const userId = await memberId(env, email)
  const claimed = (await env.DB.prepare('SELECT user_id FROM members').all<{ user_id: string }>()).results.map((r) => r.user_id)
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM records').first<{ n: number }>()
  const seed = await env.DB.prepare("SELECT v FROM meta WHERE k = 'seedVersion'").first<{ v: string }>()
  return json({ email, userId, claimed, empty: !count?.n, seedVersion: Number(seed?.v ?? 0) })
}

async function claim(env: Env, email: string, body: { userId?: string }) {
  if (!body.userId || !/^u_[\w-]+$/.test(body.userId)) return json({ error: 'Pick a profile' }, 400)
  if (await memberId(env, email)) return json({ error: 'This email already has a profile' }, 409)
  const taken = await env.DB.prepare('SELECT email FROM members WHERE user_id = ?').bind(body.userId).first()
  if (taken) return json({ error: 'Someone else already uses that profile' }, 409)
  await env.DB.prepare('INSERT INTO members (email, user_id, created_at) VALUES (?, ?, ?)').bind(email, body.userId, new Date().toISOString()).run()
  return json({ userId: body.userId })
}

// ------------------------------------------------------------------ sync

interface Change {
  store: string
  key: string
  data: Record<string, unknown> | null
  /** Sample data: insert only if this key has never existed (so deleted samples stay deleted). */
  seed?: boolean
}
interface SyncBody {
  cursor?: number
  changes?: Change[]
  seedVersion?: number
}

const PAGE = 500

async function sync(env: Env, email: string, body: SyncBody) {
  const db = env.DB
  const userId = await memberId(env, email)
  const now = new Date().toISOString()
  const rejected: string[] = []
  const stmts: D1PreparedStatement[] = []

  for (const c of (body.changes ?? []).slice(0, 200)) {
    if (!STORES.has(c.store) || typeof c.key !== 'string' || c.key.length > 200) {
      rejected.push(`${c.store}:${c.key}`)
      continue
    }
    const owner = c.data && typeof c.data.userId === 'string' ? c.data.userId : null
    const guarded = PRIVATE.has(c.store) || OWNED.has(c.store)
    if (guarded && !c.seed) {
      // You may only write your own notes, favourites and bakes.
      const existing = await db.prepare('SELECT owner FROM records WHERE store = ? AND key = ?').bind(c.store, c.key).first<{ owner: string | null }>()
      const who = c.data ? owner : existing?.owner
      if (!userId || (who && who !== userId)) {
        rejected.push(`${c.store}:${c.key}`)
        continue
      }
    }
    const data = c.data ? JSON.stringify(c.data) : null
    if (data && data.length > 500_000) {
      rejected.push(`${c.store}:${c.key}`)
      continue
    }
    const nextSeq = '(SELECT COALESCE(MAX(seq), 0) + 1 FROM records)'
    stmts.push(
      c.seed
        ? db
            .prepare(`INSERT OR IGNORE INTO records (store, key, data, owner, seq, deleted, updated_by, updated_at) VALUES (?, ?, ?, ?, ${nextSeq}, 0, ?, ?)`)
            .bind(c.store, c.key, data, owner, email, now)
        : db
            .prepare(
              `INSERT INTO records (store, key, data, owner, seq, deleted, updated_by, updated_at) VALUES (?, ?, ?, ?, ${nextSeq}, ?, ?, ?)
               ON CONFLICT (store, key) DO UPDATE SET data = excluded.data, owner = COALESCE(excluded.owner, records.owner),
               seq = excluded.seq, deleted = excluded.deleted, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
            )
            .bind(c.store, c.key, data, owner, data ? 0 : 1, email, now),
    )
  }
  if (body.seedVersion) {
    stmts.push(
      db
        .prepare("INSERT INTO meta (k, v) VALUES ('seedVersion', ?) ON CONFLICT (k) DO UPDATE SET v = MAX(CAST(v AS INTEGER), CAST(excluded.v AS INTEGER))")
        .bind(String(body.seedVersion)),
    )
  }
  if (stmts.length) await db.batch(stmts)

  // A sample record the server already has (or deleted) wasn't written; send
  // back its real state so the device doesn't keep a stale or deleted copy.
  const echo: Change[] = []
  for (const c of (body.changes ?? []).slice(0, 200)) {
    if (!c.seed || !STORES.has(c.store)) continue
    const row = await db.prepare('SELECT data, deleted, owner FROM records WHERE store = ? AND key = ?').bind(c.store, c.key).first<{ data: string | null; deleted: number; owner: string | null }>()
    if (!row || (PRIVATE.has(c.store) && row.owner !== userId)) continue
    echo.push({ store: c.store, key: c.key, data: row.deleted || !row.data ? null : (JSON.parse(row.data) as Record<string, unknown>) })
  }

  // Everything newer than the device's cursor, minus other people's private records.
  const cursor = Number(body.cursor ?? 0)
  const rows = await db
    .prepare('SELECT store, key, data, owner, seq, deleted FROM records WHERE seq > ? ORDER BY seq LIMIT ?')
    .bind(cursor, PAGE)
    .all<{ store: string; key: string; data: string | null; owner: string | null; seq: number; deleted: number }>()
  const out: Change[] = []
  let last = cursor
  for (const r of rows.results) {
    last = r.seq
    if (PRIVATE.has(r.store) && r.owner !== userId) continue
    const data = r.deleted || !r.data ? null : (JSON.parse(r.data) as Record<string, unknown>)
    if (r.store === 'recipes' && data && data.visibility === 'private' && data.ownerId !== userId) continue
    if (r.store === 'collections' && data && data.ownerId && data.ownerId !== userId) continue
    out.push({ store: r.store, key: r.key, data })
  }
  return json({ cursor: last, changes: [...echo, ...out], rejected, more: rows.results.length === PAGE })
}

// ------------------------------------------------------------------ photos

async function photo(ctx: Ctx, id: string, email: string) {
  if (!/^p_[a-z0-9]{6,40}$/i.test(id)) return json({ error: 'Bad photo id' }, 400)
  const bucket = ctx.env.PHOTOS
  if (ctx.request.method === 'GET') {
    const obj = await bucket.get(id)
    if (!obj) return json({ error: 'Not found' }, 404)
    return new Response(obj.body, {
      headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' },
    })
  }
  if (ctx.request.method === 'PUT') {
    const type = ctx.request.headers.get('Content-Type') ?? ''
    if (!type.startsWith('image/')) return json({ error: 'Only images' }, 415)
    const body = await ctx.request.arrayBuffer()
    if (body.byteLength > 6_000_000) return json({ error: 'Photo too large' }, 413)
    await bucket.put(id, body, { httpMetadata: { contentType: type }, customMetadata: { by: email } })
    return json({ ok: true })
  }
  return json({ error: 'Method not allowed' }, 405)
}

// ------------------------------------------------------------------ import

async function importPage(target: string | null) {
  let url: URL
  try {
    url = new URL(target ?? '')
  } catch {
    return json({ error: 'Give a recipe link' }, 400)
  }
  if (!/^https?:$/.test(url.protocol)) return json({ error: 'Only web links can be imported' }, 400)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HearthRecipeImport/1.0; family recipe box)', Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  })
  if (!res.ok) return json({ error: `The site answered ${res.status}` }, 502)
  if (!(res.headers.get('content-type') ?? '').includes('html')) return json({ error: 'That link is not a web page' }, 415)
  const body = await res.arrayBuffer()
  if (body.byteLength > 3_000_000) return json({ error: 'Page too large' }, 413)
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Final-Url': res.url } })
}

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
