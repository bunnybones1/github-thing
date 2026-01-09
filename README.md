# GitHub Access Map

Small GitHub client that lists the organizations and repositories your account can
reach. Built with Vite + React + TypeScript, ESLint, and the ESLint Prettier plugin.

## Setup

```bash
pnpm install
cp .env.example .env
```

## OAuth setup

1. Create a GitHub OAuth App.
   - Callback URL (local dev): `http://localhost:5173/api/auth/callback`
2. Create a Cloudflare KV namespace for sessions and update `wrangler.toml`.
   - `wrangler kv:namespace create SESSIONS`
   - `wrangler kv:namespace create SESSIONS --preview`
3. Configure credentials:
   - Set `GITHUB_CLIENT_ID` in `wrangler.toml`.
   - Set `GITHUB_CLIENT_SECRET` with `wrangler secret put GITHUB_CLIENT_SECRET`.
4. (Optional) Set `OAUTH_REDIRECT_URL` if your deploy URL is fixed.

## Usage

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
