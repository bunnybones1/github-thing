import { useMemo } from 'react'
import type { RepoFilters } from '../components/FilterPanel'
import type { GitHubOrg, GitHubRepo, GitHubUser } from '../types'
import {
  ORG_FILTER_KEY,
  PERSONAL_OTHER_KEY,
  PERSONAL_SELF_KEY,
  REPO_FILTER_KEY,
  REPO_FILTERS_KEY,
  TAB_KEY,
} from '../lib/constants'
import {
  DEFAULT_REPO_COLUMN_VISIBILITY,
  REPO_COLUMNS,
  type RepoColumnKey,
} from '../lib/repoColumns'
import { useLocalStorageState } from './useLocalStorageState'

const DEFAULT_REPO_FILTERS: RepoFilters = {
  hideArchived: false,
  hidePrivate: false,
  hidePublic: false,
}

type UseRepoViewStateArgs = {
  orgs: GitHubOrg[]
  repos: GitHubRepo[]
  profile: GitHubUser | null
}

export const useRepoViewState = ({ orgs, repos, profile }: UseRepoViewStateArgs) => {
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
    DEFAULT_REPO_FILTERS,
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
    setRepoFilters(DEFAULT_REPO_FILTERS)
  }

  const handleTabChange = (tab: 'orgs' | 'repos') => {
    setActiveTab(tab)
  }

  return {
    activeTab,
    handleTabChange,
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
  }
}
