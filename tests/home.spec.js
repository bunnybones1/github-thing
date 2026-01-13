import { expect, test } from '@playwright/test'

const API_BASE = '/api/github'

const defaultHeaders = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers':
    'x-ratelimit-limit,x-ratelimit-remaining,x-ratelimit-reset,x-ratelimit-used',
  'content-type': 'application/json',
}

const rateHeaders = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4991',
  'x-ratelimit-reset': `${Math.floor(Date.now() / 1000) + 3600}`,
  'x-ratelimit-used': '9',
}

const mockGitHubApi = async (page, handlers) => {
  await page.route(`**${API_BASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    const handler = handlers[url.pathname.replace(API_BASE, '')]
    if (handler) {
      return handler(route)
    }

    return route.fulfill({
      status: 404,
      headers: defaultHeaders,
      body: JSON.stringify({ message: 'Not found' }),
    })
  })
}

const mockAuthSession = async (page, authenticated) => {
  await page.route('**/api/auth/session', async (route) =>
    route.fulfill({
      status: authenticated ? 200 : 401,
      headers: defaultHeaders,
      body: JSON.stringify({ authenticated }),
    }),
  )
}

const dismissSplash = async (page) => {
  const beginButton = page.getByRole('button', { name: /^begin$/i })
  try {
    await beginButton.waitFor({ state: 'visible', timeout: 1000 })
    await beginButton.click()
  } catch {
    // Splash already dismissed.
  }
}

const openGitHubModal = async (page) => {
  await page.getByRole('button', { name: /github connection/i }).click()
}

const closeGitHubModal = async (page) => {
  const closeButton = page.getByRole('button', { name: /close github connection/i })
  if (await closeButton.count()) {
    await closeButton.click()
  }
}

const openGitDaemonModal = async (page) => {
  await page.getByRole('button', { name: /git daemon/i }).click()
}

const closeGitDaemonModal = async (page) => {
  const closeButton = page.getByRole('button', { name: /close git daemon/i })
  if (await closeButton.count()) {
    await closeButton.click()
  }
}

test('loads the access map landing page', async ({ page }) => {
  await mockAuthSession(page, false)
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /List every org and repo you can reach/i }),
  ).toBeVisible()
  await dismissSplash(page)
  await openGitHubModal(page)
  await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible()
})

test('requires login before loading data', async ({ page }) => {
  await mockAuthSession(page, false)
  await page.goto('/')

  await dismissSplash(page)
  await openGitHubModal(page)
  await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /load access/i })).toHaveCount(0)
})

test('loads orgs and repos and shows rate limit info', async ({ page }) => {
  const user = { login: 'octocat', name: 'Octo Cat' }
  const orgs = [
    { id: 1, login: 'openai', description: 'AI research', html_url: 'https://gh' },
  ]
  const repos = [
    {
      id: 10,
      full_name: 'openai/atlas',
      html_url: 'https://gh',
      private: true,
      archived: true,
      language: 'TypeScript',
      updated_at: '2024-01-01T12:00:00Z',
    },
  ]

  await mockAuthSession(page, true)
  await mockGitHubApi(page, {
    '/user': (route) =>
      route.fulfill({
        status: 200,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify(user),
      }),
    '/user/orgs': (route) =>
      route.fulfill({
        status: 200,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify(orgs),
      }),
    '/user/repos': (route) =>
      route.fulfill({
        status: 200,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify(repos),
      }),
  })

  await page.goto('/')
  await dismissSplash(page)
  await openGitHubModal(page)
  await page.getByRole('button', { name: /load access/i }).click()

  await expect(page.getByText('Signed in as')).toBeVisible()
  await expect(page.locator('.auth-subtitle strong')).toHaveText('octocat')

  await closeGitHubModal(page)
  await expect(page.getByRole('link', { name: 'openai', exact: true })).toBeVisible()

  await page.getByRole('tab', { name: /repositories/i }).click()
  await expect(page.getByRole('link', { name: 'openai/atlas' })).toBeVisible()

  await page.getByRole('button', { name: /rate limit info/i }).click()
  await expect(page.getByText(/Remaining/i)).toBeVisible()
  await expect(page.getByText(/4991 \/ 5000/i)).toBeVisible()
})

test('uses cached data after refresh', async ({ page }) => {
  const user = { login: 'cachebot', name: 'Cache Bot' }
  const orgs = [
    { id: 2, login: 'cached', description: 'Cached org', html_url: 'https://gh' },
  ]
  const repos = [
    {
      id: 11,
      full_name: 'cached/repo',
      html_url: 'https://gh',
      private: false,
      archived: false,
      language: 'JavaScript',
      updated_at: '2024-02-01T12:00:00Z',
    },
  ]

  await mockAuthSession(page, true)
  await mockGitHubApi(page, {
    '/user': (route) =>
      route.fulfill({
        status: 200,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify(user),
      }),
    '/user/orgs': (route) =>
      route.fulfill({
        status: 200,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify(orgs),
      }),
    '/user/repos': (route) =>
      route.fulfill({
        status: 200,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify(repos),
      }),
  })

  await page.goto('/')
  await dismissSplash(page)
  await openGitHubModal(page)
  await page.getByRole('button', { name: /load access/i }).click()
  await closeGitHubModal(page)
  await page.getByRole('tab', { name: /repositories/i }).click()
  await expect(page.getByRole('link', { name: 'cached/repo' })).toBeVisible()

  await page.getByRole('tab', { name: /organizations/i }).click()
  await page.getByRole('button', { name: /toggle cached/i }).click()

  await page.reload()

  await expect(page.getByText(/Showing cached data from/i)).toBeVisible()
  await page.getByRole('tab', { name: /repositories/i }).click()
  await expect(page.getByRole('link', { name: 'cached/repo' })).not.toBeVisible()
})

test('filters archived repos', async ({ page }) => {
  const user = { login: 'filterbot', name: 'Filter Bot' }
  const orgs = []
  const repos = [
    {
      id: 20,
      full_name: 'filter/active',
      html_url: 'https://gh',
      private: false,
      archived: false,
      language: 'TypeScript',
      updated_at: '2024-03-01T12:00:00Z',
    },
    {
      id: 21,
      full_name: 'filter/archived',
      html_url: 'https://gh',
      private: false,
      archived: true,
      language: 'TypeScript',
      updated_at: '2024-03-02T12:00:00Z',
    },
    {
      id: 22,
      full_name: 'filter/private',
      html_url: 'https://gh',
      private: true,
      archived: false,
      language: 'TypeScript',
      updated_at: '2024-03-03T12:00:00Z',
    },
  ]

  await mockAuthSession(page, true)
  await mockGitHubApi(page, {
    '/user': (route) =>
      route.fulfill({
        status: 200,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify(user),
      }),
    '/user/orgs': (route) =>
      route.fulfill({
        status: 200,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify(orgs),
      }),
    '/user/repos': (route) =>
      route.fulfill({
        status: 200,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify(repos),
      }),
  })

  await page.goto('/')
  await dismissSplash(page)
  await openGitHubModal(page)
  await page.getByRole('button', { name: /load access/i }).click()
  await closeGitHubModal(page)
  await page.getByRole('tab', { name: /repositories/i }).click()

  await expect(page.getByRole('link', { name: 'filter/active' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'filter/archived' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'filter/private' })).toBeVisible()

  await page.getByRole('button', { name: /filters/i }).click()
  await page.getByRole('button', { name: /hide archived/i }).click()
  await page.getByRole('button', { name: /hide private/i }).click()

  await expect(page.getByRole('link', { name: 'filter/archived' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'filter/private' })).toHaveCount(0)
})

test('surfaces API errors', async ({ page }) => {
  await mockAuthSession(page, true)
  await mockGitHubApi(page, {
    '/user': (route) =>
      route.fulfill({
        status: 401,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify({ message: 'Bad credentials' }),
      }),
    '/user/orgs': (route) =>
      route.fulfill({
        status: 401,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify({ message: 'Bad credentials' }),
      }),
    '/user/repos': (route) =>
      route.fulfill({
        status: 401,
        headers: { ...defaultHeaders, ...rateHeaders },
        body: JSON.stringify({ message: 'Bad credentials' }),
      }),
  })

  await page.goto('/')
  await dismissSplash(page)
  await openGitHubModal(page)
  await page.getByRole('button', { name: /load access/i }).click()
  await closeGitHubModal(page)

  await expect(page.getByText(/Sign in with GitHub to continue/i)).toBeVisible()
})

test('dismisses splash and persists it', async ({ page }) => {
  await mockAuthSession(page, false)
  await page.goto('/')

  const beginButton = page.getByRole('button', { name: /^begin$/i })
  await expect(beginButton).toBeVisible()
  await beginButton.click()
  await expect(beginButton).toHaveCount(0)

  await page.reload()
  await expect(beginButton).toHaveCount(0)
})

test('opens and closes connection modals', async ({ page }) => {
  await mockAuthSession(page, false)
  await page.goto('/')

  await dismissSplash(page)
  await openGitHubModal(page)
  await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible()
  await closeGitHubModal(page)
  await expect(page.getByRole('button', { name: /sign in with github/i })).toHaveCount(0)

  await openGitDaemonModal(page)
  await expect(page.getByLabel('Base URL')).toBeVisible()
  await closeGitDaemonModal(page)
  await expect(page.getByLabel('Base URL')).toHaveCount(0)
})

test('shows pairing required and waking daemon state', async ({ page }) => {
  await mockAuthSession(page, false)
  await page.route('**/v1/meta', async (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        version: '1.0.0',
        pairing: { required: true, paired: false },
        workspace: { configured: true },
      }),
    }),
  )

  await page.goto('/')
  await dismissSplash(page)
  await openGitDaemonModal(page)
  await page.getByRole('button', { name: /^connect$/i }).click()

  const daemonButton = page.locator('.menu-button-daemon')
  await expect(daemonButton).toContainText('Pairing required')
  await expect(page.locator('.menu-button-daemon .daemon-robot')).toHaveAttribute(
    'src',
    /waking\.png$/,
  )
})

test('shows the daemon floater when header is out of view', async ({ page }) => {
  await mockAuthSession(page, false)
  await page.goto('/')
  await dismissSplash(page)
  await page.addStyleTag({ content: 'body { min-height: 200vh; }' })

  const floater = page.locator('.daemon-floater')
  await expect(floater).toHaveCount(0)

  await page.evaluate(() => globalThis.scrollTo(0, globalThis.document.body.scrollHeight))
  await expect(floater).toBeVisible()

  await floater.click()
  await expect(page.getByLabel('Base URL')).toBeVisible()
})
