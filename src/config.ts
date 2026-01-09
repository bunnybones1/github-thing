const api =
  typeof import.meta.env.VITE_GITHUB_API === 'string'
    ? import.meta.env.VITE_GITHUB_API
    : '/api/github'

export const GITHUB_API = api.replace(/\/$/, '')
