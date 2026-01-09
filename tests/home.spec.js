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

test('loads the access map landing page', async ({ page }) => {
  await mockAuthSession(page, false)
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /List every org and repo you can reach/i }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in with github/i })).toBeVisible()
})

test('requires login before loading data', async ({ page }) => {
  await mockAuthSession(page, false)
  await page.goto('/')

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
  await page.getByRole('button', { name: /load access/i }).click()

  await expect(page.getByText('Signed in as')).toBeVisible()
  await expect(page.getByRole('heading', { name: /octocat/i })).toBeVisible()
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
  await page.getByRole('button', { name: /load access/i }).click()
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
  await page.getByRole('button', { name: /load access/i }).click()
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
  await page.getByRole('button', { name: /load access/i }).click()

  await expect(page.getByText(/Sign in with GitHub to continue/i)).toBeVisible()
})
