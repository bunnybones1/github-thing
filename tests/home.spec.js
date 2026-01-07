import { expect, test } from '@playwright/test'

test('loads the access map landing page', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /List every org and repo you can reach/i }),
  ).toBeVisible()
  await expect(page.getByLabel('Personal access token')).toBeVisible()
})
