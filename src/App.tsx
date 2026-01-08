import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { readCache, writeCache } from './cache'
import Hero from './components/Hero'
import CacheNotice from './components/CacheNotice'
import OrgPanel from './components/OrgPanel'
import RateLimitFooter from './components/RateLimitFooter'
import RepoPanel from './components/RepoPanel'
import Summary from './components/Summary'
import TokenForm from './components/TokenForm'
import { GITHUB_API } from './config'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { formatDateTime } from './lib/format'
import { fetchAllPages, fetchJson, pickMoreConservativeRate } from './lib/githubApi'
import type { GitHubOrg, GitHubRepo, GitHubUser, RateLimitInfo } from './types'
import './App.css'

const TOKEN_KEY = 'github-access-token-v1'
const TAB_KEY = 'github-access-tab-v1'

function App() {
  const [token, setToken] = useLocalStorageState(TOKEN_KEY, '')
  const [showToken, setShowToken] = useState(false)
  const [orgs, setOrgs] = useState<GitHubOrg[]>([])
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [profile, setProfile] = useState<GitHubUser | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [isRateLimitOpen, setIsRateLimitOpen] = useState(false)
  const [activeTab, setActiveTab] = useLocalStorageState<'orgs' | 'repos'>(
    TAB_KEY,
    'orgs',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token.trim()) return
    if (typeof window !== 'undefined') {
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
      <Hero />

      <TokenForm
        token={token}
        showToken={showToken}
        loading={loading}
        onTokenChange={setToken}
        onSubmit={handleSubmit}
        onToggleShow={() => setShowToken((value) => !value)}
        onClearToken={handleClearToken}
      />

      <CacheNotice isCached={isCached} lastUpdatedLabel={lastUpdatedLabel} />

      {error ? <div className="alert error">{error}</div> : null}

      {profile ? (
        <Summary
          profile={profile}
          orgCount={orgs.length}
          repoCount={repos.length}
          onRefresh={handleRefresh}
          canRefresh={canRefresh}
          loading={loading}
          lastUpdatedLabel={lastUpdatedLabel}
        />
      ) : null}

      <div className="panel-stack">
        <div className="panel-tabs" role="tablist" aria-label="Access views">
          <button
            type="button"
            className={`tab-button ${activeTab === 'orgs' ? 'active' : ''}`}
            onClick={() => setActiveTab('orgs')}
            role="tab"
            aria-selected={activeTab === 'orgs'}
          >
            Organizations
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'repos' ? 'active' : ''}`}
            onClick={() => setActiveTab('repos')}
            role="tab"
            aria-selected={activeTab === 'repos'}
          >
            Repositories
          </button>
        </div>
        {activeTab === 'orgs' ? (
          <OrgPanel orgs={sortedOrgs} />
        ) : (
          <RepoPanel repos={sortedRepos} />
        )}
      </div>

      <RateLimitFooter
        rateLimit={rateLimit}
        isOpen={isRateLimitOpen}
        onToggle={() => setIsRateLimitOpen((value) => !value)}
      />
    </div>
  )
}

export default App
