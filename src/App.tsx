import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { readCache, writeCache } from './cache'
import Hero from './components/Hero'
import CacheNotice from './components/CacheNotice'
import ColumnConfigPanel from './components/ColumnConfigPanel'
import OrgPanel from './components/OrgPanel'
import RateLimitFooter from './components/RateLimitFooter'
import RepoPanel from './components/RepoPanel'
import Summary from './components/Summary'
import TabHeader from './components/TabHeader'
import TokenForm from './components/TokenForm'
import { GITHUB_API } from './config'
import {
  ORG_FILTER_KEY,
  PERSONAL_OTHER_KEY,
  PERSONAL_SELF_KEY,
  TAB_KEY,
  TOKEN_KEY,
} from './lib/constants'
import {
  DEFAULT_REPO_COLUMN_VISIBILITY,
  REPO_COLUMNS,
  type RepoColumnKey,
} from './lib/repoColumns'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { formatDateTime } from './lib/format'
import { fetchAllPages, fetchJson, pickMoreConservativeRate } from './lib/githubApi'
import type { GitHubOrg, GitHubRepo, GitHubUser, RateLimitInfo } from './types'
import './App.css'

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
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useLocalStorageState<'orgs' | 'repos'>(
    TAB_KEY,
    'orgs',
  )
  const [orgFilters, setOrgFilters] = useLocalStorageState<Record<string, boolean>>(
    ORG_FILTER_KEY,
    {},
  )
  const [columnVisibility, setColumnVisibility] = useLocalStorageState(
    'repo-table-columns-v1',
    DEFAULT_REPO_COLUMN_VISIBILITY,
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

  useEffect(() => {
    if (activeTab === 'orgs' && isColumnPanelOpen) {
      setIsColumnPanelOpen(false)
    }
  }, [activeTab, isColumnPanelOpen])

  const sortedOrgs = useMemo(
    () => [...orgs].sort((a, b) => a.login.localeCompare(b.login)),
    [orgs],
  )

  const orgVisibility = useMemo<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {}
    for (const org of orgs) {
      next[org.login] = orgFilters[org.login] ?? true
    }
    return next
  }, [orgFilters, orgs])

  const personalVisibility = useMemo(
    () => ({
      self: orgFilters[PERSONAL_SELF_KEY] ?? true,
      other: orgFilters[PERSONAL_OTHER_KEY] ?? true,
    }),
    [orgFilters],
  )

  const sortedRepos = useMemo(
    () => [...repos].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [repos],
  )

  const scopedRepos = useMemo(() => {
    const orgSet = new Set(orgs.map((org) => org.login))
    return sortedRepos.filter((repo) => {
      if (!repo.full_name) return true
      const owner = repo.full_name.split('/')[0]
      if (!owner) return true
      if (orgSet.has(owner)) return orgVisibility[owner] ?? true
      if (profile?.login && owner === profile.login) {
        return personalVisibility.self
      }
      return personalVisibility.other
    })
  }, [orgVisibility, orgs, personalVisibility, profile?.login, sortedRepos])

  const handleToggleOrg = (login: string) => {
    setOrgFilters((prev) => ({
      ...prev,
      [login]: !(prev?.[login] ?? true),
    }))
  }

  const hiddenColumnCount = REPO_COLUMNS.filter(
    ({ key }) => columnVisibility[key] === false,
  ).length

  const handleColumnToggle = (key: RepoColumnKey) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [key]: !(prev?.[key] ?? true),
    }))
  }

  const handleResetColumns = () => {
    setColumnVisibility(DEFAULT_REPO_COLUMN_VISIBILITY)
  }

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
        <div className="panel-tabs-wrapper">
          <TabHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showConfig={isColumnPanelOpen}
            hiddenCount={hiddenColumnCount}
            onToggleConfig={() => setIsColumnPanelOpen((value) => !value)}
            configEnabled={activeTab === 'repos'}
          />
          <ColumnConfigPanel
            isOpen={isColumnPanelOpen}
            visibility={columnVisibility}
            onToggle={(key) => handleColumnToggle(key)}
            onReset={handleResetColumns}
          />
        </div>
        {activeTab === 'orgs' ? (
          <OrgPanel
            orgs={sortedOrgs}
            visibility={orgVisibility}
            personalVisibility={personalVisibility}
            profileLogin={profile?.login ?? null}
            onToggle={handleToggleOrg}
          />
        ) : (
          <RepoPanel
            repos={scopedRepos}
            totalCount={sortedRepos.length}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
          />
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
