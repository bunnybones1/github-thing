import { useRef, useState } from 'react'
import { Toaster } from 'sonner'
import CacheNotice from './components/CacheNotice'
import ColumnConfigPanel from './components/ColumnConfigPanel'
import FilterPanel from './components/FilterPanel'
import ConnectionsHub from './components/ConnectionsHub'
import OrgPanel from './components/OrgPanel'
import RateLimitFooter from './components/RateLimitFooter'
import RepoPanel from './components/RepoPanel'
import SplashModal from './components/SplashModal'
import Summary from './components/Summary'
import TabHeader from './components/TabHeader'
import { useGitHubAccess } from './hooks/useGitHubAccess'
import { useGitDaemon } from './hooks/useGitDaemon'
import { usePopoverDismiss } from './hooks/usePopoverDismiss'
import { useRepoViewState } from './hooks/useRepoViewState'
import { formatDateTime } from './lib/format'
import './App.css'

function App() {
  const [isRateLimitOpen, setIsRateLimitOpen] = useState(false)
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const tabsWrapperRef = useRef<HTMLDivElement | null>(null)
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

  const {
    activeTab,
    handleTabChange: handleRepoTabChange,
    sortedOrgs,
    orgVisibility,
    personalVisibility,
    sortedRepos,
    filteredRepos,
    repoFilter,
    setRepoFilter,
    repoFilters,
    handleFilterToggle,
    handleResetFilters,
    columnVisibility,
    setColumnVisibility,
    handleColumnToggle,
    handleResetColumns,
    hiddenColumnCount,
    handleToggleOrg,
  } = useRepoViewState({ orgs, repos, profile })

  usePopoverDismiss({
    isOpen: isColumnPanelOpen || isFilterPanelOpen,
    containerRef: tabsWrapperRef,
    onDismiss: () => {
      setIsColumnPanelOpen(false)
      setIsFilterPanelOpen(false)
    },
  })

  const handleTabChange = (tab: 'orgs' | 'repos') => {
    handleRepoTabChange(tab)
    if (tab === 'orgs') {
      setIsColumnPanelOpen(false)
      setIsFilterPanelOpen(false)
    }
  }

  const lastUpdatedLabel = lastUpdated ? formatDateTime(lastUpdated) : null
  const canRefresh = authStatus === 'authenticated' && !loading

  return (
    <div className="app">
      <Toaster position="top-right" richColors />
      <SplashModal />

      <ConnectionsHub
        authStatus={authStatus}
        loading={loading}
        canRefresh={canRefresh}
        onLogin={gitHubAccess.onLogin}
        onLogout={gitHubAccess.onLogout}
        onLoadAccess={gitHubAccess.onLoadAccess}
        daemonBaseUrl={gitDaemon.baseUrl}
        daemonStatus={gitDaemon.status}
        daemonIsThinking={gitDaemon.isThinking}
        daemonError={gitDaemon.error}
        daemonMeta={gitDaemon.meta}
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
