const api =
  typeof import.meta.env.VITE_GITHUB_API === 'string'
    ? import.meta.env.VITE_GITHUB_API
    : '/api/github'

const windowDaemonApi =
  typeof window !== 'undefined' &&
  typeof (window as { __GIT_DAEMON_API__?: unknown }).__GIT_DAEMON_API__ ===
    'string'
    ? (window as { __GIT_DAEMON_API__?: string }).__GIT_DAEMON_API__
    : ''

const windowDaemonToken =
  typeof window !== 'undefined' &&
  typeof (window as { __GIT_DAEMON_TOKEN__?: unknown }).__GIT_DAEMON_TOKEN__ ===
    'string'
    ? (window as { __GIT_DAEMON_TOKEN__?: string }).__GIT_DAEMON_TOKEN__
    : ''

const daemonApiEnv =
  typeof import.meta.env.VITE_GIT_DAEMON_API === 'string'
    ? import.meta.env.VITE_GIT_DAEMON_API
    : ''

const daemonTokenEnv =
  typeof import.meta.env.VITE_GIT_DAEMON_TOKEN === 'string'
    ? import.meta.env.VITE_GIT_DAEMON_TOKEN
    : ''

const daemonApi = daemonApiEnv || windowDaemonApi || 'http://127.0.0.1:8790'
const daemonToken = daemonTokenEnv || windowDaemonToken

export const GITHUB_API = api.replace(/\/$/, '')
export const GIT_DAEMON_API = daemonApi.replace(/\/$/, '')
export const GIT_DAEMON_TOKEN = daemonToken
