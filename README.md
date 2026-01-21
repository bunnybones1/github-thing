# GitHub Access Map

Small GitHub client that lists the organizations and repositories your account can
reach. Built with Vite + React + TypeScript, ESLint, and the ESLint Prettier plugin.

## Setup

```bash
pnpm install
cp .env.example .env
```

Optional for git-daemon healthchecks:

```
VITE_GIT_DAEMON_API=http://127.0.0.1:8790
VITE_GIT_DAEMON_TOKEN=...
```

## OAuth setup

1. Create a GitHub OAuth App.
   - Callback URL (local dev): `http://localhost:5173/api/auth/callback`
2. Create a Cloudflare KV namespace for sessions and update `wrangler.toml`.
   - `wrangler kv namespace create SESSIONS`
   - `wrangler kv namespace create SESSIONS --preview`
3. Configure credentials for local dev:
   - Copy `.dev.vars.example` to `.dev.vars` and fill in the values.
4. Configure production/preview credentials:
   - Create a `.prod.vars` file (not committed) with:
     - `GITHUB_CLIENT_ID=...`
     - `GITHUB_CLIENT_SECRET=...`
     - `OAUTH_REDIRECT_URL=...`
   - Use `pnpm deploy:vars` in CI to apply vars + secrets (keys ending in `_SECRET`).

## Usage

test

Run the worker and Vite:

```bash
pnpm dev:worker
pnpm dev
```

Open the app and click "Sign in with GitHub" to authorize. Use "Load access" or
"Refresh data" whenever you want fresh results.
The login request asks for `read:org`, `repo`, and `read:user`.

If your worker runs on a different origin, set `WORKER_ORIGIN` before `pnpm dev`.

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

CI deploy with `.prod.vars`:

```bash
pnpm deploy:vars
```

If your Wrangler version expects `--var KEY=VALUE`, pass `--var-delimiter "="`.
