# GitHub Access Map

Small GitHub client that lists the organizations and repositories your token can
reach. Built with Vite + React + TypeScript, ESLint, and the ESLint Prettier plugin.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Usage

1. Create a personal access token.
   - Classic token: `read:org` scope is enough for orgs + repos.
   - Fine-grained token: allow org membership + repo read.
2. Or use the GitHub CLI to generate an OAuth token:

```bash
gh auth login --scopes read:org,repo
gh auth token
```

3. Paste the token into the app and click "Load access".
   - Tokens are stored locally until you clear them.

## Linting

```bash
pnpm lint
```

## Checks

```bash
pnpm check
```

## Playwright

```bash
pnpm dev
```

In another terminal:

```bash
pnpm exec playwright install
pnpm test:e2e
```

## Cloudflare Workers

```bash
pnpm build
pnpm dev:worker
```

Deploy:

```bash
pnpm deploy
```
