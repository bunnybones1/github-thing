import { useEffect, useMemo, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import AuthPanel from './components/AuthPanel'
import GitDaemonPanel from './components/GitDaemonPanel'
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
import { useGitHubAccess } from './hooks/useGitHubAccess'
import { useGitDaemon } from './hooks/useGitDaemon'
import { formatDateTime } from './lib/format'
import './App.css'

function App() {
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
  const gitHubAccess = useGitHubAccess()
  const gitDaemon = useGitDaemon()

  const authStatus = gitHubAccess.authStatus
  const orgs = gitHubAccess.orgs
  const repos = gitHubAccess.repos
  const profile = gitHubAccess.profile
  const lastUpdated = gitHubAccess.lastUpdated
  const rateLimit = gitHubAccess.rateLimit
  const isCached = gitHubAccess.isCached
  const loading = gitHubAccess.loading
  const error = gitHubAccess.error

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
  }, [orgVisibility, orgs, personalVisibility, profile, sortedRepos])

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

  const handleToggleOrg = (login: string) => {
    setOrgFilters((prev) => ({
      ...prev,
      [login]: !(prev?.[login] ?? true),
    }))
  }

  const handleTabChange = (tab: 'orgs' | 'repos') => {
    setActiveTab(tab)
    if (tab === 'orgs') {
      setIsColumnPanelOpen(false)
      setIsFilterPanelOpen(false)
    }
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

  const lastUpdatedLabel = lastUpdated ? formatDateTime(lastUpdated) : null
  const canRefresh = authStatus === 'authenticated' && !loading

  return (
    <div className="app">
      <Toaster position="top-right" richColors />
      <Hero />

      <AuthPanel
        status={authStatus}
        loading={loading}
        canLoad={canRefresh}
        onLogin={gitHubAccess.onLogin}
        onLogout={gitHubAccess.onLogout}
        onLoadAccess={gitHubAccess.onLoadAccess}
      />

      <GitDaemonPanel
        baseUrl={gitDaemon.baseUrl}
        status={gitDaemon.status}
        error={gitDaemon.error}
        meta={gitDaemon.meta}
        pairing={gitDaemon.pairing}
        pairCode={gitDaemon.pairCode}
        hasToken={gitDaemon.hasToken}
        onBaseUrlChange={gitDaemon.onBaseUrlChange}
        onConnect={gitDaemon.onConnect}
        onPairStart={gitDaemon.onPairStart}
        onPairConfirm={gitDaemon.onPairConfirm}
        onForgetToken={gitDaemon.onForgetToken}
        onPairCodeChange={gitDaemon.setPairCode}
      />

      <CacheNotice isCached={isCached} lastUpdatedLabel={lastUpdatedLabel} />

      {error ? <div className="alert error">{error}</div> : null}

      {profile ? (
        <Summary
          profile={profile}
          orgCount={orgs.length}
          repoCount={repos.length}
          onRefresh={gitHubAccess.onRefresh}
          canRefresh={canRefresh}
          loading={loading}
          lastUpdatedLabel={lastUpdatedLabel}
        />
      ) : null}

      <div className="panel-stack">
        <div className="panel-tabs-wrapper" ref={tabsWrapperRef}>
          <TabHeader
            activeTab={activeTab}
            onTabChange={handleTabChange}
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
            gitDaemon={gitDaemon.gitDaemonControls}
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
