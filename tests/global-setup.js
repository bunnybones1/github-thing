const DEFAULT_BASE_URL = 'http://127.0.0.1:5173'
const ALT_BASE_URL = 'http://localhost:5173'

const resolveBaseUrl = (config) => {
  if (process.env.PLAYWRIGHT_BASE_URL) return process.env.PLAYWRIGHT_BASE_URL
  if (config?.use?.baseURL) return config.use.baseURL
  if (config?.projects?.length) {
    for (const project of config.projects) {
      if (project.use?.baseURL) return project.use.baseURL
    }
  }
  return DEFAULT_BASE_URL
}

const checkServer = async (baseURL) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const response = await fetch(baseURL, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

export default async function globalSetup(config) {
  const baseURL = resolveBaseUrl(config)
  try {
    await checkServer(baseURL)
  } catch (error) {
    if (!process.env.PLAYWRIGHT_BASE_URL && baseURL !== ALT_BASE_URL) {
      try {
        await checkServer(ALT_BASE_URL)
        process.env.PLAYWRIGHT_BASE_URL = ALT_BASE_URL
        config.use = { ...(config.use ?? {}), baseURL: ALT_BASE_URL }
        return
      } catch {
        // Fall through to error.
      }
    }
    const message =
      error instanceof Error ? error.message : 'Unable to reach the dev server'
    throw new Error(
      `Playwright preflight failed: ${message}. Start the dev server with "pnpm dev" before running tests.`,
    )
  }
}
