import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const GITHUB_API = 'https://api.github.com'

type GitHubUser = {
  login: string
  name: string | null
}

type GitHubOrg = {
  id: number
  login: string
  description: string | null
  html_url: string
}

type GitHubRepo = {
  id: number
  full_name: string
  html_url: string
  private: boolean
  language: string | null
  updated_at: string
}

const buildHeaders = (token: string) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
})

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

const fetchJson = async <T,>(url: string, token: string): Promise<T> => {
  const response = await fetch(url, { headers: buildHeaders(token) })
  const data = await readJson(response)
  if (!response.ok) {
    const message = getErrorMessage(data, `GitHub error ${response.status}`)
    throw new Error(message)
  }
  return data as T
}

const fetchAllPages = async <T,>(url: string, token: string): Promise<T[]> => {
  const items: T[] = []
  let nextUrl = url
  while (nextUrl) {
    const response = await fetch(nextUrl, { headers: buildHeaders(token) })
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

function App() {
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [orgs, setOrgs] = useState<GitHubOrg[]>([])
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [profile, setProfile] = useState<GitHubUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sortedOrgs = useMemo(
    () => [...orgs].sort((a, b) => a.login.localeCompare(b.login)),
    [orgs],
  )

  const sortedRepos = useMemo(
    () => [...repos].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [repos],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanedToken = token.trim()
    if (!cleanedToken) {
      setError('Add a GitHub personal access token to continue.')
      return
    }
    setLoading(true)
    setError('')
    setProfile(null)
    setOrgs([])
    setRepos([])
    try {
      const [userData, orgData, repoData] = await Promise.all([
        fetchJson<GitHubUser>(`${GITHUB_API}/user`, cleanedToken),
        fetchAllPages<GitHubOrg>(
          `${GITHUB_API}/user/orgs?per_page=100`,
          cleanedToken,
        ),
        fetchAllPages<GitHubRepo>(
          `${GITHUB_API}/user/repos?per_page=100&affiliation=owner,collaborator,organization_member`,
          cleanedToken,
        ),
      ])
      setProfile(userData)
      setOrgs(orgData)
      setRepos(repoData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

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
            <li>Tokens stay in memory only and never leave your browser.</li>
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
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Loading...' : 'Load access'}
          </button>
        </div>
        <p className="hint">
          We read from <code>api.github.com</code> using your token and never store
          it.
        </p>
      </form>

      {error ? (
        <div className="alert error">{error}</div>
      ) : null}

      {profile ? (
        <section className="summary">
          <div>
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
    </div>
  )
}

export default App
