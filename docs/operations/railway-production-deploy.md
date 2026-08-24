# Railway Production Deployment

LeadReacher deploys the web application and API as separate Railway services
from the same pnpm monorepo. Each service must use its own config-as-code file.
Do not add a repository-root `railway.toml`: Railway applies a root config to
every service and it will override the service-specific dashboard settings.

## Release flow

GitHub Actions owns validation; Railway's GitHub integration owns deployment.
This avoids two systems issuing competing deployment commands.

- Pull requests, `develop`, and `main` run `.github/workflows/ci.yml`.
- `develop` is the staging branch. Configure the Railway staging services to
  deploy commits pushed to `develop`, then open a reviewed pull request from
  `develop` to `main` for production promotion.
- Configure the Railway production services to deploy commits pushed to `main`.
- After a successful CI run on either branch,
  `.github/workflows/deployment-smoke.yml` waits for the deployed API and web
  application, then verifies API readiness, API liveness, and the web root.

Deployment smoke runs automatically after a successful CI deployment whenever
both environment URLs below are configured. It records a skipped check until
then, rather than producing a false failure for an unconfigured target.

Create GitHub environments named `staging` and `production`. Add these
environment secrets, pointing at the matching environment's public services:

| Secret | Value |
| --- | --- |
| `STAGING_API_URL` | Public staging API base URL. Add only to the `staging` environment. |
| `STAGING_WEB_URL` | Public staging web base URL. Add only to the `staging` environment. |
| `PRODUCTION_API_URL` | Public production API base URL. Add only to the `production` environment. |
| `PRODUCTION_WEB_URL` | Public production web base URL. Add only to the `production` environment. |

The names remain explicit so a failed or manually dispatched smoke check cannot
accidentally target production. Configure the production environment with the
required reviewer protection rule before enabling the production deploy branch.

To roll back, use Railway's deployment rollback for the affected service, then
run **Deployment smoke** manually from GitHub Actions against the restored
environment.

The dedicated staging topology, its provider isolation requirements, and the
worker-pause rehearsal are maintained in
[`staging-environment.md`](staging-environment.md). Do not point a staging
service at a production database, Redis instance, Unipile sender, R2 bucket, or
Stripe credential to make a deployment start faster.

## Web service

Configure `@leadreacher/web` with:

- Root directory: repository root (leave unset)
- Railway config file: `/apps/web/railway.toml`
- Watch path: `/apps/web/**`

The service builds and starts through the root pnpm workspace. Configure the
public frontend environment variables on this service only.

## API service

Configure `@leadreacher/api` with:

- Root directory: repository root (leave unset)
- Railway config file: `/apps/api/railway.toml`
- Watch paths: `/apps/api/**`, `/packages/shared/**`, `/package.json`,
  `/pnpm-lock.yaml`, and `/pnpm-workspace.yaml`

The API and worker configuration files resolve either the repository-root
monorepo layout or the legacy `/apps/api` service root. Keep an existing
production service package-rooted until its next reviewed deployment if needed,
but use the repository root for new and staging services so the workspace lock
file and `@leadreacher/shared` are present during builds. Configure the API
environment variables from
[`apps/api/src/config/env.ts`](../../apps/api/src/config/env.ts) on this
service. Set `NODE_ENV=production`.

The pre-deploy command runs `prisma migrate deploy`. Every directory under
`apps/api/prisma/migrations` must contain a committed `migration.sql`; an empty
migration directory makes Prisma reject the deployment.

Railway uses `GET /health` for API deployment liveness so API and worker
services can deploy independently. `GET /ready` verifies Postgres and Redis;
in production it also returns `503` until every required worker lease is fresh.
Deployment smoke and release checks must use `/ready` as the strict dependency
gate.

## Required worker service

Create a third Railway service from the API package for all background work:

```text
node dist/worker.js
```

Configure it with the repository root, `/apps/api/railway.worker.toml`, and
the same API/shared workspace watch paths. The worker has no pre-deploy
migration command; migrations remain on the API service only.

Set these values on the worker service:

```text
RUNTIME_ROLE=worker
ENABLE_CAMPAIGN_WORKER=true
ENABLE_RECONCILE_WORKER=true
ENABLE_VIDEO_WORKER=true
ENABLE_ANALYTICS_INSIGHTS_WORKER=true
ENABLE_LIFECYCLE_WORKER=true
SENTRY_DSN=<required>
BETTERSTACK_CAMPAIGN_WORKER_HEARTBEAT_URL=<required>
BETTERSTACK_VIDEO_WORKER_HEARTBEAT_URL=<required>
BETTERSTACK_RECONCILE_WORKER_HEARTBEAT_URL=<required>
```

Set every `ENABLE_*_WORKER` flag to `false` on the API service. Migrations run
only through the API service pre-deploy command. The worker exits on startup in
production when a required worker flag, Sentry DSN, or heartbeat URL is absent.
The three external heartbeats cover campaign, video, and reconciliation work;
lifecycle is part of reconciliation maintenance. Analytics has no separate
heartbeat because its Redis lease is required by the API readiness check.

## Video prerequisites

Before enabling the video worker, provide the selected provider credential,
the TTS credential for personalized videos, and all Cloudflare R2 credentials.
Keep `VIDEO_MOCK_MODE=false` in production. Test the provider, TTS, and storage
integration in a non-production environment first.

## Rollout checks

1. Confirm the deployment details show the expected service-specific config
   path and commands.
2. Confirm the web deployment starts with `@leadreacher/web`.
3. Confirm API pre-deploy migrations complete successfully.
4. Run `pnpm --filter @leadreacher/api preflight:production` with production
   configuration. It validates Stripe prices, Unipile connectivity, and public
   R2 MP4 byte-range playback without sending outreach.
5. Confirm API `GET /health` and `GET /ready` return `200`; readiness proves
   the worker leases are fresh.
6. Check runtime logs and Sentry for startup or queue failures.
7. Confirm staging deployment smoke, provider canary, functional E2E, and safe
   journeys have passed for the release candidate, then run the protected and
   human-approved checks in
   [`production-e2e-runbook.md`](production-e2e-runbook.md).
