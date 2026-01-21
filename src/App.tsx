import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readCache, writeCache } from './cache'
import AuthPanel from './components/AuthPanel'
import Hero from './components/Hero'
import CacheNotice from './components/CacheNotice'
import ColumnConfigPanel from './components/ColumnConfigPanel'
import FilterPanel from './components/FilterPanel'
import type { RepoFilters } from './components/FilterPanel'
import OrgPanel from './components/OrgPanel'
import RateLimitFooter from './components/RateLimitFooter'
import RepoPanel from './components/RepoPanel'
import Summary from './components/Summary'
import TabHeader from './components/TabHeader'
import { GIT_DAEMON_TOKEN, GITHUB_API } from './config'
import {
  ORG_FILTER_KEY,
  PERSONAL_OTHER_KEY,
  PERSONAL_SELF_KEY,
  REPO_FILTER_KEY,
  REPO_FILTERS_KEY,
  TAB_KEY,
} from './lib/constants'
import {
  DEFAULT_REPO_COLUMN_VISIBILITY,
  REPO_COLUMNS,
  type RepoColumnKey,
} from './lib/repoColumns'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { formatDateTime } from './lib/format'
import {
  GitHubApiError,
  fetchAllPages,
  fetchJson,
  pickMoreConservativeRate,
} from './lib/githubApi'
import {
  checkDaemonAvailable,
  startHealthcheckRun,
  waitForHealthcheckResult,
} from './lib/daemonApi'
import type {
  GitHubOrg,
  GitHubRepo,
  GitHubUser,
  RateLimitInfo,
  RepoRecord,
} from './types'
import './App.css'

const getRepoKey = (repo: RepoRecord) => repo.full_name ?? String(repo.id)

function App() {
  const [authStatus, setAuthStatus] = useState<
    'checking' | 'authenticated' | 'unauthenticated'
  >('checking')
  const [orgs, setOrgs] = useState<GitHubOrg[]>([])
  const [repos, setRepos] = useState<RepoRecord[]>([])
  const [profile, setProfile] = useState<GitHubUser | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [isRateLimitOpen, setIsRateLimitOpen] = useState(false)
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const tabsWrapperRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useLocalStorageState<'orgs' | 'repos'>(
    TAB_KEY,
    'orgs',
  )
  const [orgFilters, setOrgFilters] = useLocalStorageState<Record<string, boolean>>(
    ORG_FILTER_KEY,
    {},
  )
  const [repoFilter, setRepoFilter] = useLocalStorageState(REPO_FILTER_KEY, '')
  const [columnVisibility, setColumnVisibility] = useLocalStorageState(
    'repo-table-columns-v1',
    DEFAULT_REPO_COLUMN_VISIBILITY,
  )
  const [repoFilters, setRepoFilters] = useLocalStorageState<RepoFilters>(
    REPO_FILTERS_KEY,
    {
      hideArchived: false,
      hidePrivate: false,
      hidePublic: false,
    },
  )
  const [daemonAvailability, setDaemonAvailability] = useState<
    'unknown' | 'available' | 'unavailable'
  >('unknown')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const healthcheckAttempted = useRef(new Set<string>())

  useEffect(() => {
    let isActive = true
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
        })
        if (!isActive) return
        setAuthStatus(response.ok ? 'authenticated' : 'unauthenticated')
      } catch {
        if (!isActive) return
        setAuthStatus('unauthenticated')
      }
    }
    checkSession()
    return () => {
      isActive = false
    }
  }, [])

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
    if (activeTab === 'orgs' && isFilterPanelOpen) {
      setIsFilterPanelOpen(false)
    }
  }, [activeTab, isColumnPanelOpen, isFilterPanelOpen])

  useEffect(() => {
    if (!isColumnPanelOpen && !isFilterPanelOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (tabsWrapperRef.current?.contains(target)) return
      setIsColumnPanelOpen(false)
      setIsFilterPanelOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isColumnPanelOpen, isFilterPanelOpen])

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

  const visibleRepos = useMemo(() => {
    const needle = repoFilter.trim().toLowerCase()
    if (!needle) return scopedRepos
    return scopedRepos.filter((repo) =>
      (repo.full_name || '').toLowerCase().includes(needle),
    )
  }, [repoFilter, scopedRepos])

  const filteredRepos = useMemo(() => {
    return visibleRepos.filter((repo) => {
      if (repoFilters.hideArchived && repo.archived) return false
      if (repoFilters.hidePrivate && repo.private) return false
      if (repoFilters.hidePublic && !repo.private) return false
      return true
    })
  }, [
    repoFilters.hideArchived,
    repoFilters.hidePrivate,
    repoFilters.hidePublic,
    visibleRepos,
  ])

  const updateRepoHealthchecks = useCallback(
    (repoKey: string, healthchecks: RepoRecord['healthchecks']) => {
      setRepos((prev) => {
        let didUpdate = false
        const next = prev.map((repo) => {
          if (getRepoKey(repo) !== repoKey) return repo
          didUpdate = true
          return { ...repo, healthchecks }
        })
        return didUpdate ? next : prev
      })
    },
    [],
  )

  useEffect(() => {
    if (activeTab !== 'repos') return
    if (columnVisibility.healthchecks === false) return
    if (!GIT_DAEMON_TOKEN) return
    if (daemonAvailability === 'unavailable') return
    if (!repos.length) return

    let isActive = true
    const controller = new AbortController()

    const runHealthchecks = async () => {
      const isAvailable =
        daemonAvailability === 'available'
          ? true
          : await checkDaemonAvailable(controller.signal)
      if (!isActive) return
      if (!isAvailable) {
        setDaemonAvailability('unavailable')
        return
      }
      if (daemonAvailability !== 'available') {
        setDaemonAvailability('available')
      }

      const pending = repos.filter((repo) => {
        if (!repo.full_name) return false
        if (repo.healthchecks) return false
        const key = getRepoKey(repo)
        if (healthcheckAttempted.current.has(key)) return false
        return true
      })

      if (!pending.length) return

      for (const repo of pending) {
        const key = getRepoKey(repo)
        healthcheckAttempted.current.add(key)
      }

      const queue = [...pending]
      const limit = Math.min(3, queue.length)
      const workers = Array.from({ length: limit }, async () => {
        while (queue.length && isActive) {
          const repo = queue.shift()
          if (!repo || !repo.full_name) continue
          const repoKey = getRepoKey(repo)
          try {
            const jobId = await startHealthcheckRun(repo.full_name, controller.signal)
            if (!jobId || !isActive) {
              continue
            }
            const result = await waitForHealthcheckResult(jobId, {
              signal: controller.signal,
            })
            if (result && isActive) {
              updateRepoHealthchecks(repoKey, result)
            }
          } catch {
            // Ignore healthcheck failures and keep the UI responsive.
          }
        }
      })

      await Promise.all(workers)
    }

    runHealthchecks()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [
    activeTab,
    columnVisibility.healthchecks,
    daemonAvailability,
    repos,
    updateRepoHealthchecks,
  ])

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

  const handleFilterToggle = (key: keyof RepoFilters) => {
    setRepoFilters((prev) => ({
      ...prev,
      [key]: !(prev?.[key] ?? false),
    }))
  }

  const handleResetFilters = () => {
    setRepoFilters({
      hideArchived: false,
      hidePrivate: false,
      hidePublic: false,
    })
  }

  const fetchAccess = async () => {
    setLoading(true)
    setError('')
    healthcheckAttempted.current.clear()
    setDaemonAvailability('unknown')
    let latestRateLimit: RateLimitInfo | null = null
    const captureRateLimit = (info: RateLimitInfo) => {
      latestRateLimit = pickMoreConservativeRate(latestRateLimit, info)
    }
    try {
      const [userData, orgData, repoData] = await Promise.all([
        fetchJson<GitHubUser>(`${GITHUB_API}/user`, captureRateLimit),
        fetchAllPages<GitHubOrg>(
          `${GITHUB_API}/user/orgs?per_page=100`,
          captureRateLimit,
        ),
        fetchAllPages<GitHubRepo>(
          `${GITHUB_API}/user/repos?per_page=100&affiliation=owner,collaborator,organization_member`,
          captureRateLimit,
        ),
      ])
      const updatedAt = new Date().toISOString()
      setProfile(userData)
      setOrgs(orgData)
      const nextRepos: RepoRecord[] = repoData
      setRepos(nextRepos)
      setRateLimit(latestRateLimit)
      setLastUpdated(updatedAt)
      setIsCached(false)
      try {
        await writeCache({
          profile: userData,
          orgs: orgData,
          repos: nextRepos,
          lastUpdated: updatedAt,
          rateLimit: latestRateLimit,
        })
      } catch {
        // Cache write errors shouldn't block the UI.
      }
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 401) {
        setAuthStatus('unauthenticated')
        setError('Sign in with GitHub to continue.')
      } else {
        const message = err instanceof Error ? err.message : 'Something went wrong.'
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLoadAccess = async () => {
    if (authStatus !== 'authenticated') {
      setError('Sign in with GitHub to continue.')
      return
    }
    await fetchAccess()
  }

  const handleRefresh = async () => {
    if (authStatus !== 'authenticated') {
      setError('Sign in with GitHub to continue.')
      return
    }
    await fetchAccess()
  }

  const handleLogin = () => {
    if (typeof window === 'undefined') return
    const returnTo = `${window.location.pathname}${window.location.search}`
    const url = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    window.location.assign(url)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Ignore logout errors.
    } finally {
      setAuthStatus('unauthenticated')
      setError('')
    }
  }

  const lastUpdatedLabel = lastUpdated ? formatDateTime(lastUpdated) : null
  const canRefresh = authStatus === 'authenticated' && !loading

  return (
    <div className="app">
      <Hero />

      <AuthPanel
        status={authStatus}
        loading={loading}
        canLoad={canRefresh}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onLoadAccess={handleLoadAccess}
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
        <div className="panel-tabs-wrapper" ref={tabsWrapperRef}>
          <TabHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showConfig={isColumnPanelOpen}
            showFilters={isFilterPanelOpen}
            hiddenCount={hiddenColumnCount}
            filterCount={
              [
                repoFilters.hideArchived,
                repoFilters.hidePrivate,
                repoFilters.hidePublic,
              ].filter(Boolean).length
            }
            onToggleConfig={() =>
              setIsColumnPanelOpen((value) => {
                if (!value) setIsFilterPanelOpen(false)
                return !value
              })
            }
            onToggleFilters={() =>
              setIsFilterPanelOpen((value) => {
                if (!value) setIsColumnPanelOpen(false)
                return !value
              })
            }
            configEnabled={activeTab === 'repos'}
            filterValue={repoFilter}
            onFilterChange={setRepoFilter}
          />
          <div className="panel-popovers">
            <FilterPanel
              isOpen={isFilterPanelOpen}
              filters={repoFilters}
              onToggle={handleFilterToggle}
              onReset={handleResetFilters}
            />
            <ColumnConfigPanel
              isOpen={isColumnPanelOpen}
              visibility={columnVisibility}
              onToggle={(key) => handleColumnToggle(key)}
              onReset={handleResetColumns}
            />
          </div>
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
            repos={filteredRepos}
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
