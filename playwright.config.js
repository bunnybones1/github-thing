import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  globalSetup: './tests/global-setup.js',
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
})
