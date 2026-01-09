type AssetFetcher = {
  fetch(request: Request): Promise<Response>
}

type KVNamespace = {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface Env {
  ASSETS: AssetFetcher
  SESSIONS?: KVNamespace
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  OAUTH_REDIRECT_URL?: string
  SESSION_TTL_SECONDS?: string
}

type SessionRecord = {
  token: string
  scope: string | null
}

const GITHUB_API = 'https://api.github.com'
const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const DEFAULT_SESSION_TTL = 60 * 60 * 24 * 14
const SESSION_COOKIE = 'gh_session'
const STATE_COOKIE = 'gh_oauth_state'
const RETURN_COOKIE = 'gh_oauth_return'

const memorySessions = new Map<string, SessionRecord>()

const parseCookies = (request: Request): Record<string, string> => {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return {}
  const entries = cookieHeader.split(';').map((part) => part.trim())
  const cookies: Record<string, string> = {}
  for (const entry of entries) {
    const index = entry.indexOf('=')
    if (index === -1) continue
    const name = entry.slice(0, index).trim()
    const value = entry.slice(index + 1).trim()
    if (name) {
      cookies[name] = decodeURIComponent(value)
    }
  }
  return cookies
}

const sanitizeReturnTo = (value: string | null) => {
  if (!value) return '/'
  try {
    const parsed = new URL(value, 'http://localhost')
    if (parsed.origin !== 'http://localhost') return '/'
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
  } catch {
    return '/'
  }
}

const buildCookie = (
  name: string,
  value: string,
  options: {
    maxAge?: number
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
    path?: string
  } = {},
) => {
  const segments = [`${name}=${encodeURIComponent(value)}`]
  if (options.maxAge !== undefined) segments.push(`Max-Age=${options.maxAge}`)
  if (options.path) segments.push(`Path=${options.path}`)
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`)
  if (options.httpOnly) segments.push('HttpOnly')
  if (options.secure) segments.push('Secure')
  return segments.join('; ')
}

const buildJsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const getSession = async (
  env: Env,
  sessionId: string | undefined,
): Promise<SessionRecord | null> => {
  if (!sessionId) return null
  if (env.SESSIONS) {
    const stored = await env.SESSIONS.get(sessionId)
    if (!stored) return null
    try {
      return JSON.parse(stored) as SessionRecord
    } catch {
      return null
    }
  }
  return memorySessions.get(sessionId) ?? null
}

const setSession = async (env: Env, sessionId: string, record: SessionRecord) => {
  if (env.SESSIONS) {
    const ttl = Number(env.SESSION_TTL_SECONDS || DEFAULT_SESSION_TTL)
    await env.SESSIONS.put(sessionId, JSON.stringify(record), {
      expirationTtl: Number.isFinite(ttl) ? ttl : DEFAULT_SESSION_TTL,
    })
  } else {
    memorySessions.set(sessionId, record)
  }
}

const clearSession = async (env: Env, sessionId: string | undefined) => {
  if (!sessionId) return
  if (env.SESSIONS) {
    await env.SESSIONS.delete(sessionId)
  } else {
    memorySessions.delete(sessionId)
  }
}

const shouldFallbackToSpa = (request: Request) => {
  if (request.method !== 'GET') return false
  const { pathname } = new URL(request.url)
  return !pathname.startsWith('/api/')
}

const handleLogin = async (request: Request, env: Env) => {
  const clientId = env.GITHUB_CLIENT_ID
  if (!clientId) {
    return new Response('Missing GITHUB_CLIENT_ID', { status: 500 })
  }

  const url = new URL(request.url)
  const origin = url.origin
  const redirectUri = env.OAUTH_REDIRECT_URL || `${origin}/api/auth/callback`
  const state = crypto.randomUUID()
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'))

  const authorizeUrl = new URL(AUTHORIZE_URL)
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('scope', 'read:org repo read:user')

  const secure = url.protocol === 'https:'
  const headers = new Headers({
    location: authorizeUrl.toString(),
  })
  headers.append(
    'Set-Cookie',
    buildCookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    }),
  )
  headers.append(
    'Set-Cookie',
    buildCookie(RETURN_COOKIE, returnTo, {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    }),
  )
  return new Response(null, { status: 302, headers })
}

const handleCallback = async (request: Request, env: Env) => {
  const clientId = env.GITHUB_CLIENT_ID
  const clientSecret = env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return new Response('Missing GitHub OAuth credentials', { status: 500 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return new Response('Missing OAuth code or state', { status: 400 })
  }

  const cookies = parseCookies(request)
  if (!cookies[STATE_COOKIE] || cookies[STATE_COOKIE] !== state) {
    return new Response('Invalid OAuth state', { status: 400 })
  }

  const redirectUri = env.OAUTH_REDIRECT_URL || `${url.origin}/api/auth/callback`
  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string
    scope?: string
    token_type?: string
    error?: string
    error_description?: string
  }

  if (!tokenResponse.ok || !tokenData.access_token) {
    const message = tokenData.error_description || tokenData.error || 'OAuth failed'
    return new Response(message, { status: 401 })
  }

  const sessionId = crypto.randomUUID()
  await setSession(env, sessionId, {
    token: tokenData.access_token,
    scope: tokenData.scope ?? null,
  })

  const secure = url.protocol === 'https:'
  const headers = new Headers({
    location: cookies[RETURN_COOKIE] || '/',
  })
  headers.append(
    'Set-Cookie',
    buildCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: Number(env.SESSION_TTL_SECONDS || DEFAULT_SESSION_TTL),
    }),
  )
  headers.append(
    'Set-Cookie',
    buildCookie(STATE_COOKIE, '', {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }),
  )
  headers.append(
    'Set-Cookie',
    buildCookie(RETURN_COOKIE, '', {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }),
  )
  return new Response(null, { status: 302, headers })
}

const handleSessionStatus = async (request: Request, env: Env) => {
  const cookies = parseCookies(request)
  const session = await getSession(env, cookies[SESSION_COOKIE])
  if (!session) {
    return buildJsonResponse({ authenticated: false }, 401)
  }
  return buildJsonResponse({ authenticated: true, scope: session.scope }, 200)
}

const handleLogout = async (request: Request, env: Env) => {
  const cookies = parseCookies(request)
  await clearSession(env, cookies[SESSION_COOKIE])
  const secure = new URL(request.url).protocol === 'https:'
  const headers = new Headers()
  headers.append(
    'Set-Cookie',
    buildCookie(SESSION_COOKIE, '', {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }),
  )
  return new Response(null, { status: 204, headers })
}

const handleProxy = async (request: Request, env: Env) => {
  const cookies = parseCookies(request)
  const session = await getSession(env, cookies[SESSION_COOKIE])
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(request.url)
  const upstreamPath = url.pathname.replace(/^\/api\/github/, '')
  const normalizedPath = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`
  const upstreamUrl = new URL(`${GITHUB_API}${normalizedPath}${url.search}`)

  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${session.token}`)
  headers.set('Accept', headers.get('Accept') || 'application/vnd.github+json')
  headers.set('X-GitHub-Api-Version', '2022-11-28')
  headers.set('User-Agent', 'github-thing')
  headers.delete('cookie')
  headers.delete('host')

  const init = {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  }

  return fetch(upstreamUrl, init)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/auth/login')) {
      return handleLogin(request, env)
    }
    if (url.pathname.startsWith('/api/auth/callback')) {
      return handleCallback(request, env)
    }
    if (url.pathname.startsWith('/api/auth/session')) {
      return handleSessionStatus(request, env)
    }
    if (url.pathname.startsWith('/api/auth/logout')) {
      return handleLogout(request, env)
    }
    if (url.pathname.startsWith('/api/github')) {
      return handleProxy(request, env)
    }

    let response = await env.ASSETS.fetch(request)
    if (response.status === 404 && shouldFallbackToSpa(request)) {
      const url = new URL(request.url)
      const fallbackRequest = new Request(new URL('/index.html', url), request)
      response = await env.ASSETS.fetch(fallbackRequest)
    }
    return response
  },
}
