import { handleApi, type Env } from './api'

/**
 * Cloudflare Worker entry. The built app (dist/) is served as static assets;
 * anything that isn't a file — i.e. /api/* — reaches this function.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return handleApi({ request, env })
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
