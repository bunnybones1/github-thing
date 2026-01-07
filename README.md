# GitHub Access Map

Small GitHub client that lists the organizations and repositories your token can
reach. Built with Vite + React + TypeScript, ESLint, and the ESLint Prettier plugin.

## Setup

```bash
pnpm install
pnpm dev
```

## Usage

1. Create a personal access token.
   - Classic token: `read:org` scope is enough for orgs + repos.
   - Fine-grained token: allow org membership + repo read.
2. Paste the token into the app and click "Load access".

## Linting

```bash
pnpm lint
```

## Playwright

```bash
pnpm exec playwright install
pnpm test:e2e
```
