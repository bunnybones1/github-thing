import { expect, test } from '@playwright/test'

const API_BASE = 'https://api.github.com'

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

const handleOptions = (route) =>
  route.fulfill({
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers':
        'authorization,content-type,accept,x-github-api-version',
    },
  })

const mockGitHubApi = async (page, handlers) => {
  await page.route(`${API_BASE}/**`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return handleOptions(route)
    }

    const url = new URL(route.request().url())
    const handler = handlers[url.pathname]
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

test('loads the access map landing page', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /List every org and repo you can reach/i }),
  ).toBeVisible()
  await expect(page.getByLabel('Personal access token')).toBeVisible()
})

test('requires a token before loading data', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /load access/i }).click()

  await expect(
    page.getByText(/Add a GitHub personal access token to continue/i),
  ).toBeVisible()
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
  await page.getByLabel('Personal access token').fill('ghp_fake')
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
  await page.getByLabel('Personal access token').fill('ghp_cache')
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

test('surfaces API errors', async ({ page }) => {
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
  await page.getByLabel('Personal access token').fill('ghp_bad')
  await page.getByRole('button', { name: /load access/i }).click()

  await expect(page.getByText(/Bad credentials/i)).toBeVisible()
})
