import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { readCache, writeCache } from './cache'
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
import { GITHUB_API } from './config'
import {
  GIT_DAEMON_TOKEN_KEY,
  GIT_DAEMON_URL_KEY,
  ORG_FILTER_KEY,
  PERSONAL_OTHER_KEY,
  PERSONAL_SELF_KEY,
  REPO_FILTER_KEY,
  REPO_FILTERS_KEY,
  TAB_KEY,
} from './lib/constants'
import {
  getDefaultGitDaemonBaseUrl,
  normalizeGitDaemonBaseUrl,
  type GitDaemonMeta,
  type GitDaemonOpenTarget,
  type GitDaemonPairConfirmResponse,
  type GitDaemonPairStartResponse,
  type RepoCloneStatus,
} from './lib/gitDaemon'
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
import type { GitHubOrg, GitHubRepo, GitHubUser, RateLimitInfo } from './types'
import './App.css'

function App() {
  const [authStatus, setAuthStatus] = useState<
    'checking' | 'authenticated' | 'unauthenticated'
  >('checking')
  const [orgs, setOrgs] = useState<GitHubOrg[]>([])
  const [repos, setRepos] = useState<GitHubRepo[]>([])
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [daemonBaseUrl, setDaemonBaseUrl] = useLocalStorageState(
    GIT_DAEMON_URL_KEY,
    getDefaultGitDaemonBaseUrl(),
  )
  const [daemonToken, setDaemonToken] = useLocalStorageState<string | null>(
    GIT_DAEMON_TOKEN_KEY,
    null,
  )
  const [daemonStatus, setDaemonStatus] = useState<
    'idle' | 'checking' | 'ready' | 'error'
  >('idle')
  const [daemonMeta, setDaemonMeta] = useState<GitDaemonMeta | null>(null)
  const [daemonError, setDaemonError] = useState('')
  const [pairingInfo, setPairingInfo] = useState<GitDaemonPairStartResponse | null>(null)
  const [pairCode, setPairCode] = useState('')
  const [repoCloneStatuses, setRepoCloneStatuses] = useState<
    Record<string, RepoCloneStatus>
  >({})
  const [repoOpenErrors, setRepoOpenErrors] = useState<
    Record<string, Partial<Record<GitDaemonOpenTarget, boolean>>>
  >({})
  const cloneInFlightRef = useRef<Set<string>>(new Set())
  const clonePollTimeoutsRef = useRef<Record<string, number>>({})
  const clonePollAttemptsRef = useRef<Record<string, number>>({})

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

  useEffect(() => {
    return () => {
      for (const timeout of Object.values(clonePollTimeoutsRef.current)) {
        window.clearTimeout(timeout)
      }
    }
  }, [])

  const readDaemonErrorPayload = useCallback(async (response: Response) => {
    try {
      const payload = (await response.json()) as { message?: string; errorCode?: string }
      if (payload && (payload.message || payload.errorCode)) {
        return {
          message: payload.message || `Request failed (${response.status})`,
          errorCode: payload.errorCode,
        }
      }
    } catch {
      // Ignore parsing errors.
    }
    return { message: `Request failed (${response.status})` }
  }, [])

  const readDaemonError = useCallback(
    async (response: Response) => (await readDaemonErrorPayload(response)).message,
    [readDaemonErrorPayload],
  )

  const handleDaemonUnauthorized = useCallback(() => {
    setDaemonToken(null)
    setDaemonError('Pairing token missing or expired. Reconnect to git-daemon.')
  }, [setDaemonToken])

  const handleDaemonConnect = useCallback(async () => {
    const normalized = normalizeGitDaemonBaseUrl(daemonBaseUrl)
    if (!normalized) {
      setDaemonError('Enter the git-daemon base URL.')
      setDaemonStatus('error')
      return
    }
    setDaemonBaseUrl(normalized)
    setDaemonStatus('checking')
    setDaemonError('')
    setPairingInfo(null)
    try {
      const response = await fetch(`${normalized}/v1/meta`)
      if (!response.ok) {
        setDaemonStatus('error')
        setDaemonMeta(null)
        setDaemonError(await readDaemonError(response))
        return
      }
      const data = (await response.json()) as GitDaemonMeta
      setDaemonMeta(data)
      setDaemonStatus('ready')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach git-daemon.'
      setDaemonStatus('error')
      setDaemonMeta(null)
      setDaemonError(message)
    }
  }, [daemonBaseUrl, readDaemonError, setDaemonBaseUrl])

  const handleBaseUrlChange = useCallback(
    (value: string) => {
      setDaemonBaseUrl(value)
      setDaemonStatus('idle')
      setDaemonMeta(null)
      setDaemonError('')
      setPairingInfo(null)
      setPairCode('')
    },
    [setDaemonBaseUrl],
  )

  const handlePairStart = useCallback(async () => {
    const normalized = normalizeGitDaemonBaseUrl(daemonBaseUrl)
    if (!normalized) {
      setDaemonError('Enter the git-daemon base URL.')
      return
    }
    setDaemonError('')
    try {
      const response = await fetch(`${normalized}/v1/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'start' }),
      })
      if (!response.ok) {
        setDaemonError(await readDaemonError(response))
        return
      }
      const data = (await response.json()) as GitDaemonPairStartResponse
      setPairingInfo(data)
      setPairCode(data.code ?? '')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pairing failed.'
      setDaemonError(message)
    }
  }, [daemonBaseUrl, readDaemonError])

  const handlePairConfirm = useCallback(async () => {
    const normalized = normalizeGitDaemonBaseUrl(daemonBaseUrl)
    const code = pairCode.trim()
    if (!normalized) {
      setDaemonError('Enter the git-daemon base URL.')
      return
    }
    if (!code) {
      setDaemonError('Enter the pairing code.')
      return
    }
    setDaemonError('')
    try {
      const response = await fetch(`${normalized}/v1/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'confirm', code }),
      })
      if (!response.ok) {
        setDaemonError(await readDaemonError(response))
        return
      }
      const data = (await response.json()) as GitDaemonPairConfirmResponse
      setDaemonToken(data.accessToken)
      setPairingInfo(null)
      setPairCode('')
      await handleDaemonConnect()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pairing failed.'
      setDaemonError(message)
    }
  }, [daemonBaseUrl, handleDaemonConnect, pairCode, readDaemonError, setDaemonToken])

  const handleForgetToken = useCallback(() => {
    setDaemonToken(null)
  }, [setDaemonToken])

  const daemonBaseUrlNormalized = useMemo(
    () => normalizeGitDaemonBaseUrl(daemonBaseUrl),
    [daemonBaseUrl],
  )
  const daemonReady =
    daemonStatus === 'ready' &&
    (daemonMeta?.pairing.required === false || Boolean(daemonToken))

  const clearClonePoll = useCallback((repoPath: string) => {
    const timeout = clonePollTimeoutsRef.current[repoPath]
    if (timeout) {
      window.clearTimeout(timeout)
      delete clonePollTimeoutsRef.current[repoPath]
    }
    delete clonePollAttemptsRef.current[repoPath]
  }, [])

  const resetDaemonTracking = useCallback(() => {
    for (const timeout of Object.values(clonePollTimeoutsRef.current)) {
      window.clearTimeout(timeout)
    }
    clonePollTimeoutsRef.current = {}
    clonePollAttemptsRef.current = {}
    cloneInFlightRef.current.clear()
    setRepoCloneStatuses({})
    setRepoOpenErrors({})
  }, [setRepoCloneStatuses, setRepoOpenErrors])

  useEffect(() => {
    resetDaemonTracking()
  }, [daemonBaseUrl, resetDaemonTracking])

  useEffect(() => {
    if (!daemonReady) {
      resetDaemonTracking()
    }
  }, [daemonReady, resetDaemonTracking])

  const checkRepoStatus = useCallback(
    async (repoPath: string, options?: { force?: boolean }) => {
      if (!daemonReady || !repoPath) return
      setRepoCloneStatuses((prev) => {
        const current = prev[repoPath]
        if (!options?.force && current && current !== 'unknown' && current !== 'error') {
          return prev
        }
        if (cloneInFlightRef.current.has(repoPath)) {
          return { ...prev, [repoPath]: 'cloning' }
        }
        return { ...prev, [repoPath]: 'checking' }
      })
      try {
        const response = await fetch(
          `${daemonBaseUrlNormalized}/v1/git/status?repoPath=${encodeURIComponent(
            repoPath,
          )}`,
          {
            headers: daemonToken ? { Authorization: `Bearer ${daemonToken}` } : undefined,
          },
        )
        if (response.status === 404) {
          if (cloneInFlightRef.current.has(repoPath)) {
            setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'cloning' }))
            if (!clonePollTimeoutsRef.current[repoPath]) {
              const attempt = (clonePollAttemptsRef.current[repoPath] ?? 0) + 1
              clonePollAttemptsRef.current[repoPath] = attempt
              if (attempt > 60) {
                cloneInFlightRef.current.delete(repoPath)
                clearClonePoll(repoPath)
                setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'error' }))
                return
              }
              const delay = Math.min(1500 + attempt * 250, 6000)
              clonePollTimeoutsRef.current[repoPath] = window.setTimeout(() => {
                delete clonePollTimeoutsRef.current[repoPath]
                checkRepoStatus(repoPath, { force: true })
              }, delay)
            }
          } else {
            setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'missing' }))
          }
          return
        }
        if (response.status === 401) {
          handleDaemonUnauthorized()
          cloneInFlightRef.current.delete(repoPath)
          clearClonePoll(repoPath)
          setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'error' }))
          return
        }
        if (!response.ok) {
          cloneInFlightRef.current.delete(repoPath)
          clearClonePoll(repoPath)
          setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'error' }))
          return
        }
        cloneInFlightRef.current.delete(repoPath)
        clearClonePoll(repoPath)
        setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'exists' }))
      } catch {
        cloneInFlightRef.current.delete(repoPath)
        clearClonePoll(repoPath)
        setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'error' }))
      }
    },
    [
      clearClonePoll,
      daemonBaseUrlNormalized,
      daemonReady,
      daemonToken,
      handleDaemonUnauthorized,
    ],
  )

  const clearOpenError = useCallback(
    (repoPath: string, target: GitDaemonOpenTarget) => {
      setRepoOpenErrors((prev) => {
        const current = prev[repoPath]
        if (!current?.[target]) return prev
        const next = { ...current }
        delete next[target]
        const updated = { ...prev }
        if (Object.keys(next).length === 0) {
          delete updated[repoPath]
        } else {
          updated[repoPath] = next
        }
        return updated
      })
    },
    [setRepoOpenErrors],
  )

  const setOpenError = useCallback(
    (repoPath: string, target: GitDaemonOpenTarget) => {
      setRepoOpenErrors((prev) => {
        const current = prev[repoPath]
        if (current?.[target]) return prev
        return {
          ...prev,
          [repoPath]: { ...(current ?? {}), [target]: true },
        }
      })
    },
    [setRepoOpenErrors],
  )

  const handleCloneRepo = useCallback(
    async (repo: GitHubRepo) => {
      if (!daemonReady) return
      const repoPath = repo.full_name || ''
      const repoUrl = repo.ssh_url || repo.clone_url
      if (!repoPath || !repoUrl) return
      cloneInFlightRef.current.add(repoPath)
      clearClonePoll(repoPath)
      setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'cloning' }))
      try {
        const response = await fetch(`${daemonBaseUrlNormalized}/v1/git/clone`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(daemonToken ? { Authorization: `Bearer ${daemonToken}` } : {}),
          },
          body: JSON.stringify({ repoUrl, destRelative: repoPath }),
        })
        if (response.status === 401) {
          const error = await readDaemonErrorPayload(response)
          handleDaemonUnauthorized()
          cloneInFlightRef.current.delete(repoPath)
          clearClonePoll(repoPath)
          setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'error' }))
          toast.error(error.message)
          return
        }
        if (!response.ok) {
          const error = await readDaemonErrorPayload(response)
          cloneInFlightRef.current.delete(repoPath)
          clearClonePoll(repoPath)
          setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'error' }))
          toast.error(error.message)
          return
        }
        window.setTimeout(() => {
          checkRepoStatus(repoPath, { force: true })
        }, 1500)
      } catch {
        cloneInFlightRef.current.delete(repoPath)
        clearClonePoll(repoPath)
        setRepoCloneStatuses((prev) => ({ ...prev, [repoPath]: 'error' }))
      }
    },
    [
      checkRepoStatus,
      clearClonePoll,
      daemonBaseUrlNormalized,
      daemonReady,
      daemonToken,
      handleDaemonUnauthorized,
      readDaemonErrorPayload,
    ],
  )

  const handleOpenRepo = useCallback(
    async (repo: GitHubRepo, target: GitDaemonOpenTarget) => {
      if (!daemonReady) return
      const repoPath = repo.full_name || ''
      if (!repoPath) return
      clearOpenError(repoPath, target)
      const label =
        target === 'vscode' ? 'VS Code' : target === 'terminal' ? 'terminal' : 'folder'
      const approvalTimer = window.setTimeout(() => {
        toast.info(`Waiting for approval to open ${label}. Check git-daemon.`)
      }, 2000)
      try {
        const response = await fetch(`${daemonBaseUrlNormalized}/v1/os/open`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(daemonToken ? { Authorization: `Bearer ${daemonToken}` } : {}),
          },
          body: JSON.stringify({ target, path: repoPath }),
        })
        if (response.status === 401) {
          const error = await readDaemonErrorPayload(response)
          handleDaemonUnauthorized()
          setOpenError(repoPath, target)
          toast.error(`Open ${label} failed: ${error.message}`)
          return
        }
        if (!response.ok) {
          const error = await readDaemonErrorPayload(response)
          setOpenError(repoPath, target)
          toast.error(`Open ${label} failed: ${error.message}`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Open request failed.'
        setOpenError(repoPath, target)
        toast.error(`Open ${label} failed: ${message}`)
      } finally {
        window.clearTimeout(approvalTimer)
      }
    },
    [
      clearOpenError,
      daemonBaseUrlNormalized,
      daemonReady,
      daemonToken,
      handleDaemonUnauthorized,
      readDaemonErrorPayload,
      setOpenError,
    ],
  )

  const gitDaemonControls = useMemo(
    () => ({
      enabled: daemonReady,
      repoStatuses: repoCloneStatuses,
      repoOpenErrors,
      onCheckRepoStatus: checkRepoStatus,
      onCloneRepo: handleCloneRepo,
      onOpenRepo: handleOpenRepo,
    }),
    [
      checkRepoStatus,
      daemonReady,
      handleCloneRepo,
      handleOpenRepo,
      repoCloneStatuses,
      repoOpenErrors,
    ],
  )

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
      <Toaster position="top-right" richColors />
      <Hero />

      <AuthPanel
        status={authStatus}
        loading={loading}
        canLoad={canRefresh}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onLoadAccess={handleLoadAccess}
      />

      <GitDaemonPanel
        baseUrl={daemonBaseUrl}
        status={daemonStatus}
        error={daemonError}
        meta={daemonMeta}
        pairing={pairingInfo}
        pairCode={pairCode}
        hasToken={Boolean(daemonToken)}
        onBaseUrlChange={handleBaseUrlChange}
        onConnect={handleDaemonConnect}
        onPairStart={handlePairStart}
        onPairConfirm={handlePairConfirm}
        onForgetToken={handleForgetToken}
        onPairCodeChange={setPairCode}
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
            gitDaemon={gitDaemonControls}
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
