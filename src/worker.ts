type AssetFetcher = {
  fetch(request: Request): Promise<Response>
}

export interface Env {
  ASSETS: AssetFetcher
}

const shouldFallbackToSpa = (request: Request) => {
  if (request.method !== 'GET') return false
  const { pathname } = new URL(request.url)
  return !pathname.startsWith('/api/')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response = await env.ASSETS.fetch(request)
    if (response.status === 404 && shouldFallbackToSpa(request)) {
      const url = new URL(request.url)
      const fallbackRequest = new Request(new URL('/index.html', url), request)
      response = await env.ASSETS.fetch(fallbackRequest)
    }
    return response
  },
}
