export const DEFAULT_GIT_DAEMON_HTTP = 'http://127.0.0.1:8790'
export const DEFAULT_GIT_DAEMON_HTTPS = 'https://127.0.0.1:8791'

export const getDefaultGitDaemonBaseUrl = () => {
  if (typeof window === 'undefined') return DEFAULT_GIT_DAEMON_HTTP
  return window.location.protocol === 'https:'
    ? DEFAULT_GIT_DAEMON_HTTPS
    : DEFAULT_GIT_DAEMON_HTTP
}

export const normalizeGitDaemonBaseUrl = (value: string) =>
  value.trim().replace(/\/+$/, '')

export type GitDaemonMeta = {
  version: string
  pairing: {
    required: boolean
    paired: boolean
  }
  workspace: {
    configured: boolean
    root?: string
  }
}

export type GitDaemonPairStartResponse = {
  step: 'start'
  instructions: string
  code?: string
  expiresAt?: string
}

export type GitDaemonPairConfirmResponse = {
  step: 'confirm'
  accessToken: string
  tokenType: 'Bearer'
  expiresAt?: string
}

export type RepoCloneStatus =
  | 'unknown'
  | 'checking'
  | 'missing'
  | 'exists'
  | 'cloning'
  | 'error'

export type GitDaemonOpenTarget = 'terminal' | 'folder' | 'vscode'
