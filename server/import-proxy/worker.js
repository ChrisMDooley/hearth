/**
 * Hearth import proxy — a Cloudflare Worker (free plan is plenty).
 *
 * Browsers may not read another site's HTML directly, so the app asks this
 * worker: GET /?url=https://www.farmhouseonboone.com/… → the page's HTML.
 * The app then reads the schema.org Recipe data itself and shows a draft for
 * review. Nothing is stored here.
 *
 * Settings (wrangler.toml [vars]):
 *   ALLOWED_ORIGINS  comma-separated origins allowed to call this worker,
 *                    e.g. "https://hearth.pages.dev,http://localhost:5173"
 */

const MAX_BYTES = 3_000_000

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] ?? '',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors })
    if (allowed.length && !allowed.includes(origin)) return new Response('Origin not allowed', { status: 403, headers: cors })

    const target = new URL(request.url).searchParams.get('url')
    let url
    try {
      url = new URL(target ?? '')
    } catch {
      return new Response('Give a recipe link as ?url=', { status: 400, headers: cors })
    }
    if (!/^https?:$/.test(url.protocol)) return new Response('Only web links can be imported', { status: 400, headers: cors })

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HearthRecipeImport/1.0; personal recipe box)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      cf: { cacheTtl: 3600 },
    })
    if (!res.ok) return new Response(`The site answered ${res.status}`, { status: 502, headers: cors })
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('html')) return new Response('That link is not a web page', { status: 415, headers: cors })

    const body = await res.arrayBuffer()
    if (body.byteLength > MAX_BYTES) return new Response('Page too large', { status: 413, headers: cors })
    return new Response(body, {
      headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'X-Final-Url': res.url },
    })
  },
}
