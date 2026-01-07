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

export type GitHubRepo = {
  id: number
  full_name: string
  html_url: string
  private: boolean
  language: string | null
  updated_at: string
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
  repos: GitHubRepo[]
  lastUpdated: string
  rateLimit: RateLimitInfo | null
}
