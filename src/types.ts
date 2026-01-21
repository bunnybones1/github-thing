export type GitHubUser = {
  login: string
  name: string | null
}

export type GitHubOrg = {
  id: number
  login: string
  description: string | null
  html_url: string
}

import type { components } from '@octokit/openapi-types'

export type GitHubRepo = components['schemas']['repository']

export type HealthcheckStatus = 'na' | 'failed' | 'pass-partial' | 'pass-full'

export type RepoHealthchecks = {
  status: HealthcheckStatus
  summary?: string | null
  finishedAt?: string | null
}

export type RepoRecord = GitHubRepo & {
  healthchecks?: RepoHealthchecks | null
}

export type RateLimitInfo = {
  limit: number
  remaining: number
  reset: number
  used: number | null
}

export type CachePayload = {
  profile: GitHubUser | null
  orgs: GitHubOrg[]
  repos: RepoRecord[]
  lastUpdated: string
  rateLimit: RateLimitInfo | null
}
