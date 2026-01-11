import { useCallback, useEffect, useState } from 'react'
import { readCache, writeCache } from '../cache'
import { GITHUB_API } from '../config'
import {
  GitHubApiError,
  fetchAllPages,
  fetchJson,
  pickMoreConservativeRate,
} from '../lib/githubApi'
import type { GitHubOrg, GitHubRepo, GitHubUser, RateLimitInfo } from '../types'

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

type UseGitHubAccessReturn = {
  authStatus: AuthStatus
  orgs: GitHubOrg[]
  repos: GitHubRepo[]
  profile: GitHubUser | null
  lastUpdated: string | null
  rateLimit: RateLimitInfo | null
  isCached: boolean
  loading: boolean
  error: string
  onLogin: () => void
  onLogout: () => Promise<void>
  onLoadAccess: () => Promise<void>
  onRefresh: () => Promise<void>
}

export const useGitHubAccess = (): UseGitHubAccessReturn => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [orgs, setOrgs] = useState<GitHubOrg[]>([])
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [profile, setProfile] = useState<GitHubUser | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const fetchAccess = useCallback(async () => {
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
  }, [])

  const onLoadAccess = useCallback(async () => {
    if (authStatus !== 'authenticated') {
      setError('Sign in with GitHub to continue.')
      return
    }
    await fetchAccess()
  }, [authStatus, fetchAccess])

  const onRefresh = useCallback(async () => {
    if (authStatus !== 'authenticated') {
      setError('Sign in with GitHub to continue.')
      return
    }
    await fetchAccess()
  }, [authStatus, fetchAccess])

  const onLogin = useCallback(() => {
    if (typeof window === 'undefined') return
    const returnTo = `${window.location.pathname}${window.location.search}`
    const url = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    window.location.assign(url)
  }, [])

  const onLogout = useCallback(async () => {
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
  }, [])

  return {
    authStatus,
    orgs,
    repos,
    profile,
    lastUpdated,
    rateLimit,
    isCached,
    loading,
    error,
    onLogin,
    onLogout,
    onLoadAccess,
    onRefresh,
  }
}
