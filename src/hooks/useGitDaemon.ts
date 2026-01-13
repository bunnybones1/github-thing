import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  GIT_DAEMON_AUTO_CONNECT_KEY,
  GIT_DAEMON_TOKEN_KEY,
  GIT_DAEMON_URL_KEY,
} from '../lib/constants'
import {
  getDefaultGitDaemonBaseUrl,
  normalizeGitDaemonBaseUrl,
  type GitDaemonMeta,
  type GitDaemonOpenTarget,
  type GitDaemonPairConfirmResponse,
  type GitDaemonPairStartResponse,
  type RepoCloneStatus,
} from '../lib/gitDaemon'
import { useLocalStorageState } from './useLocalStorageState'
import type { GitHubRepo } from '../types'

type GitDaemonControls = {
  enabled: boolean
  repoStatuses: Record<string, RepoCloneStatus | undefined>
  repoOpenErrors: Record<string, Partial<Record<GitDaemonOpenTarget, boolean>>>
  onCheckRepoStatus: (repoPath: string) => void
  onCloneRepo: (repo: GitHubRepo) => void
  onOpenRepo: (repo: GitHubRepo, target: GitDaemonOpenTarget) => void
}

type UseGitDaemonReturn = {
  baseUrl: string
  status: 'idle' | 'checking' | 'ready' | 'error'
  isThinking: boolean
  error: string
  meta: GitDaemonMeta | null
  pairing: GitDaemonPairStartResponse | null
  pairCode: string
  hasToken: boolean
  onBaseUrlChange: (value: string) => void
  onConnect: () => Promise<void>
  onPairStart: () => Promise<void>
  onPairConfirm: () => Promise<void>
  onForgetToken: () => void
  setPairCode: (value: string) => void
  gitDaemonControls: GitDaemonControls
}

export const useGitDaemon = (): UseGitDaemonReturn => {
  const [daemonBaseUrl, setDaemonBaseUrl] = useLocalStorageState(
    GIT_DAEMON_URL_KEY,
    getDefaultGitDaemonBaseUrl(),
  )
  const [daemonToken, setDaemonToken] = useLocalStorageState<string | null>(
    GIT_DAEMON_TOKEN_KEY,
    null,
  )
  const [shouldAutoConnect, setShouldAutoConnect] = useLocalStorageState(
    GIT_DAEMON_AUTO_CONNECT_KEY,
    false,
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
  const autoConnectAttemptedRef = useRef(false)

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
    autoConnectAttemptedRef.current = true
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
      setShouldAutoConnect(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach git-daemon.'
      setDaemonStatus('error')
      setDaemonMeta(null)
      setDaemonError(message)
    }
  }, [daemonBaseUrl, readDaemonError, setDaemonBaseUrl, setShouldAutoConnect])

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

  useEffect(() => {
    if (!shouldAutoConnect || autoConnectAttemptedRef.current) return
    autoConnectAttemptedRef.current = true
    void handleDaemonConnect()
  }, [handleDaemonConnect, shouldAutoConnect])

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

  const isThinking = useMemo(
    () => Object.values(repoCloneStatuses).some((status) => status === 'cloning'),
    [repoCloneStatuses],
  )

  return {
    baseUrl: daemonBaseUrl,
    status: daemonStatus,
    isThinking,
    error: daemonError,
    meta: daemonMeta,
    pairing: pairingInfo,
    pairCode,
    hasToken: Boolean(daemonToken),
    onBaseUrlChange: handleBaseUrlChange,
    onConnect: handleDaemonConnect,
    onPairStart: handlePairStart,
    onPairConfirm: handlePairConfirm,
    onForgetToken: handleForgetToken,
    setPairCode,
    gitDaemonControls,
  }
}
