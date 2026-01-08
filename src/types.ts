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

export type RateLimitInfo = {
  limit: number
  remaining: number
  reset: number
  used: number | null
}

export type CachePayload = {
  profile: GitHubUser | null
  orgs: GitHubOrg[]
  repos: GitHubRepo[]
  lastUpdated: string
  rateLimit: RateLimitInfo | null
}
