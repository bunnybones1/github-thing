import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { readCache, writeCache } from './cache'
import { GITHUB_API } from './config'
import type { GitHubOrg, GitHubRepo, GitHubUser, RateLimitInfo } from './types'
import './App.css'

const TOKEN_KEY = 'github-access-token-v1'

const buildHeaders = (token: string) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
})

const readRateLimit = (headers: Headers): RateLimitInfo | null => {
  const limit = Number(headers.get('x-ratelimit-limit'))
  const remaining = Number(headers.get('x-ratelimit-remaining'))
  const reset = Number(headers.get('x-ratelimit-reset'))
  const usedHeader = headers.get('x-ratelimit-used')
  const usedValue = usedHeader ? Number(usedHeader) : null

  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(reset)) {
    return null
  }

  return {
    limit,
    remaining,
    reset,
    used: Number.isFinite(usedValue) ? usedValue : null,
  }
}

const pickMoreConservativeRate = (
  current: RateLimitInfo | null,
  next: RateLimitInfo,
) => {
  if (!current) return next
  if (next.remaining < current.remaining) return next
  if (next.remaining === current.remaining && next.reset > current.reset) return next
  return current
}

const readJson = async (response: Response): Promise<unknown | null> => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const parseNextLink = (linkHeader: string | null): string | null => {
  if (!linkHeader) return null
  const parts = linkHeader.split(',')
  for (const part of parts) {
    const urlMatch = part.match(/<([^>]+)>/)
    const relMatch = part.match(/rel="([^"]+)"/)
    if (urlMatch && relMatch && relMatch[1] === 'next') {
      return urlMatch[1]
    }
  }
  return null
}

const getErrorMessage = (data: unknown, fallback: string): string => {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }
  return fallback
}

const fetchJson = async <T,>(
  url: string,
  token: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<T> => {
  const response = await fetch(url, { headers: buildHeaders(token) })
  const rateLimit = readRateLimit(response.headers)
  if (rateLimit && onRateLimit) {
    onRateLimit(rateLimit)
  }
  const data = await readJson(response)
  if (!response.ok) {
    const message = getErrorMessage(data, `GitHub error ${response.status}`)
    throw new Error(message)
  }
  return data as T
}

const fetchAllPages = async <T,>(
  url: string,
  token: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<T[]> => {
  const items: T[] = []
  let nextUrl = url
  while (nextUrl) {
    const response = await fetch(nextUrl, { headers: buildHeaders(token) })
    const rateLimit = readRateLimit(response.headers)
    if (rateLimit && onRateLimit) {
      onRateLimit(rateLimit)
    }
    const data = await readJson(response)
    if (!response.ok) {
      const message = getErrorMessage(data, `GitHub error ${response.status}`)
      throw new Error(message)
    }
    if (Array.isArray(data)) {
      items.push(...data)
    }
    nextUrl = parseNextLink(response.headers.get('link'))
  }
  return items
}

const formatDate = (isoString?: string | null) => {
  if (!isoString) return 'Unknown'
  const date = new Date(isoString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatDateTime = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatResetTime = (reset: number) => {
  return new Date(reset * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function App() {
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [orgs, setOrgs] = useState<GitHubOrg[]>([])
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [profile, setProfile] = useState<GitHubUser | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [isRateLimitOpen, setIsRateLimitOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (storedToken) {
      setToken(storedToken)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (token.trim()) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }, [token])

  useEffect(() => {
    let isActive = true
    readCache()
      .then((cached) => {
        if (!isActive) return
        if (!cached) return
        setProfile(cached.profile)
        setOrgs(cached.orgs)
        setRepos(cached.repos)
        setLastUpdated(cached.lastUpdated || null)
        setRateLimit(cached.rateLimit)
        setIsCached(true)
      })
      .catch(() => {})
    return () => {
      isActive = false
    }
  }, [])

  const sortedOrgs = useMemo(
    () => [...orgs].sort((a, b) => a.login.localeCompare(b.login)),
    [orgs],
  )

  const sortedRepos = useMemo(
    () => [...repos].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [repos],
  )

  const fetchAccess = async (cleanedToken: string) => {
    setLoading(true)
    setError('')
    let latestRateLimit: RateLimitInfo | null = null
    const captureRateLimit = (info: RateLimitInfo) => {
      latestRateLimit = pickMoreConservativeRate(latestRateLimit, info)
    }
    try {
      const [userData, orgData, repoData] = await Promise.all([
        fetchJson<GitHubUser>(`${GITHUB_API}/user`, cleanedToken, captureRateLimit),
        fetchAllPages<GitHubOrg>(
          `${GITHUB_API}/user/orgs?per_page=100`,
          cleanedToken,
          captureRateLimit,
        ),
        fetchAllPages<GitHubRepo>(
          `${GITHUB_API}/user/repos?per_page=100&affiliation=owner,collaborator,organization_member`,
          cleanedToken,
          captureRateLimit,
        ),
      ])
      const updatedAt = new Date().toISOString()
      setProfile(userData)
      setOrgs(orgData)
      setRepos(repoData)
      setRateLimit(latestRateLimit)
      setLastUpdated(updatedAt)
      setIsCached(false)
      try {
        await writeCache({
          profile: userData,
          orgs: orgData,
          repos: repoData,
          lastUpdated: updatedAt,
          rateLimit: latestRateLimit,
        })
      } catch {
        // Cache write errors shouldn't block the UI.
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanedToken = token.trim()
    if (!cleanedToken) {
      setError('Add a GitHub personal access token to continue.')
      return
    }
    await fetchAccess(cleanedToken)
  }

  const handleRefresh = async () => {
    const cleanedToken = token.trim()
    if (!cleanedToken) {
      setError('Add a GitHub personal access token to continue.')
      return
    }
    await fetchAccess(cleanedToken)
  }

  const handleClearToken = () => {
    setToken('')
    setShowToken(false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY)
    }
  }

  const lastUpdatedLabel = lastUpdated ? formatDateTime(lastUpdated) : null
  const canRefresh = Boolean(token.trim()) && !loading

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">GitHub Access Map</p>
          <h1>List every org and repo you can reach</h1>
          <p className="lead">
            Paste a GitHub personal access token to map your organization
            memberships and repository access in one view.
          </p>
        </div>
        <div className="hero-card">
          <h2>Token checklist</h2>
          <ul>
            <li>Classic token: use the <strong>read:org</strong> scope.</li>
            <li>Fine-grained token: allow org membership + repo read.</li>
            <li>Tokens stay in your browser and can be cleared anytime.</li>
          </ul>
        </div>
      </header>

      <form className="token-form" onSubmit={handleSubmit}>
        <label htmlFor="token">Personal access token</label>
        <div className="token-row">
          <input
            id="token"
            className="token-input"
            type={showToken ? 'text' : 'password'}
            placeholder="ghp_..."
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <button
            type="button"
            className="button ghost"
            onClick={() => setShowToken((value) => !value)}
          >
            {showToken ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={handleClearToken}
            disabled={!token}
          >
            Clear
          </button>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Loading...' : 'Load access'}
          </button>
        </div>
        <p className="hint">
          We read from <code>api.github.com</code>. Tokens are stored locally until
          you clear them.
        </p>
      </form>

      {isCached && lastUpdatedLabel ? (
        <div className="alert info">
          Showing cached data from {lastUpdatedLabel}. Click refresh to fetch the
          latest.
        </div>
      ) : null}

      {error ? (
        <div className="alert error">{error}</div>
      ) : null}

      {profile ? (
        <section className="summary">
          <div className="summary-main">
            <p className="summary-title">Signed in as</p>
            <h2>{profile.login}</h2>
            <p className="summary-subtitle">{profile.name || 'GitHub user'}</p>
          </div>
          <div className="summary-metrics">
            <div>
              <p className="metric-label">Organizations</p>
              <p className="metric-value">{orgs.length}</p>
            </div>
            <div>
              <p className="metric-label">Repositories</p>
              <p className="metric-value">{repos.length}</p>
            </div>
          </div>
          <div className="summary-actions">
            <button
              className="button ghost"
              type="button"
              onClick={handleRefresh}
              disabled={!canRefresh}
            >
              {loading ? 'Refreshing...' : 'Refresh data'}
            </button>
            {lastUpdatedLabel ? (
              <p className="summary-updated">Last updated {lastUpdatedLabel}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid">
        <section className="panel">
          <div className="panel-header">
            <h3>Organizations</h3>
            <span className="pill">{orgs.length} total</span>
          </div>
          {sortedOrgs.length ? (
            <ul className="list">
              {sortedOrgs.map((org) => (
                <li key={org.id}>
                  <a href={org.html_url} target="_blank" rel="noreferrer">
                    {org.login}
                  </a>
                  <span className="muted">{org.description || 'No description'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No organizations loaded yet.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Repositories</h3>
            <span className="pill">{repos.length} total</span>
          </div>
          {sortedRepos.length ? (
            <ul className="list">
              {sortedRepos.map((repo) => (
                <li key={repo.id}>
                  <div className="repo-row">
                    <a href={repo.html_url} target="_blank" rel="noreferrer">
                      {repo.full_name}
                    </a>
                    <span className={`badge ${repo.private ? 'private' : 'public'}`}>
                      {repo.private ? 'Private' : 'Public'}
                    </span>
                  </div>
                  <div className="repo-meta">
                    <span>{repo.language || 'Unknown language'}</span>
                    <span>Updated {formatDate(repo.updated_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No repositories loaded yet.</p>
          )}
        </section>
      </div>

      <footer className="footer">
        <button
          type="button"
          className="footer-toggle"
          onClick={() => setIsRateLimitOpen((value) => !value)}
          aria-expanded={isRateLimitOpen}
        >
          Rate limit info
          <span className={`chevron ${isRateLimitOpen ? 'open' : ''}`} aria-hidden>
            ▼
          </span>
        </button>
        {isRateLimitOpen ? (
          <div className="footer-panel">
            {rateLimit ? (
              <div className="rate-grid">
                <div>
                  <p className="rate-label">Remaining</p>
                  <p className="rate-value">
                    {rateLimit.remaining} / {rateLimit.limit}
                  </p>
                </div>
                <div>
                  <p className="rate-label">Resets</p>
                  <p className="rate-value">{formatResetTime(rateLimit.reset)}</p>
                </div>
                {rateLimit.used !== null ? (
                  <div>
                    <p className="rate-label">Used</p>
                    <p className="rate-value">{rateLimit.used}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="rate-empty">Fetch data to see rate limit status.</p>
            )}
          </div>
        ) : null}
      </footer>
    </div>
  )
}

export default App
