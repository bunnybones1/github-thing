const api = import.meta.env.VITE_GITHUB_API

if (!api || typeof api !== 'string') {
  throw new Error(
    'Missing VITE_GITHUB_API. Copy .env.example to .env and set the API URL.',
  )
}

export const GITHUB_API = api.replace(/\/$/, '')
