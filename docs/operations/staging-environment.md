# Staging Environment

Staging is an isolated Railway environment for the `develop` branch. It is the
only target for automated integration validation and controlled LinkedIn
release canaries. Production remains the `main` branch environment.

## Provisioned topology

The Railway project contains an environment named `staging` with independent
services:

| Role | Railway service | Public URL |
| --- | --- | --- |
| Web | `@leadreacher/staging-web` | `https://leadreacherstaging-web-staging.up.railway.app` |
| API | `@leadreacher/staging-api` | `https://leadreacherstaging-api-staging.up.railway.app` |
| Worker | `@leadreacher/staging-worker` | No public domain |
| Database | `Postgres` | Internal Railway connection only |
| Queue/cache | `Redis` | Internal Railway connection only |

The application services follow the same service-specific Railway config files
as production. The staging API uses `/health` for deployment liveness; `/ready`
becomes the strict dependency check after the staging worker is running.

## Bootstrap checklist

Use Railway's variable-reference picker for the staging `Postgres` and `Redis`
services. Never copy a production connection string into staging.

1. Set `NODE_ENV=production`, `APP_URL` to the staging web URL, and
   `CORS_ORIGIN` to the staging web URL on the staging API. Set
   `NEXT_PUBLIC_API_URL` to the staging API URL and the staging Supabase public
   variables on the staging web service. Set `PORT=3000` on the staging web
   service because its generated Railway public domain targets port `3000`.
   For this pnpm workspace, also set these non-secret Railpack planning
   overrides before the first deploy. Railway's image planner must know a start
   command before it applies the regular service start setting:

   | Service | `RAILPACK_PACKAGES` | `RAILPACK_INSTALL_CMD` | `RAILPACK_BUILD_CMD` | `RAILPACK_START_CMD` |
   | --- | --- | --- | --- | --- |
   | `@leadreacher/staging-api` | `pnpm@9.15.9` | `pnpm install --frozen-lockfile` | `pnpm --filter @leadreacher/api build` | `cd /app/apps/api && node dist/index.js` |
   | `@leadreacher/staging-worker` | `pnpm@9.15.9` | `pnpm install --frozen-lockfile` | `pnpm --filter @leadreacher/api build` | `cd /app/apps/api && node dist/worker.js` |
   | `@leadreacher/staging-web` | `pnpm@9.15.9` | `pnpm install --frozen-lockfile` | `pnpm --filter @leadreacher/web build` | `cd apps/web && node node_modules/next/dist/bin/next start` |

   These variables are a Railpack bootstrap requirement for the monorepo, not
   provider configuration. Keep the existing app-specific `railway.toml` files
   as the source for health checks, restart behavior, and migrations. Until a
   staging deployment includes those source config changes, mirror the API and
   worker build, start, and pre-deploy commands in the Railway service settings
   so an older config file cannot override the monorepo paths. After the
   updated `apps/api/railway.toml` and `apps/api/railway.worker.toml` are
   deployed from `develop`, select those service config files again and remove
   the temporary dashboard command overrides.
   Set the staging API and worker **Root Directory** to the repository root and
   include `/packages/shared/**`, `/pnpm-lock.yaml`, and
   `/pnpm-workspace.yaml` in their watched paths. Restricting either service to
   `apps/api` omits the workspace lockfile from the Railpack build context.
2. Set `RUNTIME_ROLE=api` and every `ENABLE_*_WORKER=false` on the staging API.
3. Set `RUNTIME_ROLE=worker` and all five `ENABLE_*_WORKER=true` flags on the
   staging worker. Configure distinct staging Sentry and Better Stack projects.
4. Configure a separate staging Supabase project, Redis/Postgres references,
   a controlled Unipile sender and recipient, a staging R2 bucket/public URL,
   and staging Groq/video credentials.
5. Configure **Stripe test-mode** credentials and price IDs with
   `STRIPE_MOCK_MODE=false`. Test mode is a live Stripe API target; it is not
   the application's mock billing mode.
6. Keep `VIDEO_MOCK_MODE=false` for the real provider/R2 checks. A temporary
   mock-mode exercise is allowed only in the documented video-retry test, not
   as the normal staging configuration.
7. Set `R2_PREFLIGHT_VIDEO_URL` to a staging MP4 that supports byte-range
   playback. The canary reads only bytes `0-1` from this object.
8. Deploy `develop`, then verify `GET /health`, `GET /ready`, each enabled
   worker lease, and the three staging Better Stack heartbeats.

## First staging deploy cutover

The first deployment uses temporary Railpack planning and dashboard command
overrides while Railway learns the monorepo layout. Complete this checklist
immediately after the first `develop` revision containing the committed
`apps/api/railway.toml` and `apps/api/railway.worker.toml` files is deployed:

1. Confirm the staging API and worker deployment details reference the expected
   commit from `develop` and the selected service config files.
2. Keep the Railway Root Directory at the repository root for both services and
   verify their watched paths include the workspace lockfile and shared package.
3. Remove only the temporary dashboard build, start, and pre-deploy command
   overrides. Keep the `RAILPACK_*` planning variables from the bootstrap table
   until a later Railpack simplification is deliberately tested.
4. Redeploy the worker, then the API, and confirm API `/health` returns `200`.
5. Record `/ready`, fresh worker leases, and Better Stack heartbeat evidence in
   the release ticket before enabling the staging workflow gates.

Required GitHub environment secrets are held only in the `staging`
environment. Their names are deliberately target-specific:

| Purpose | Secrets |
| --- | --- |
| Deployment smoke | `STAGING_API_URL`, `STAGING_WEB_URL` |
| Read-only provider canary | `STAGING_STRIPE_SECRET_KEY`, all four `STAGING_STRIPE_PRICE_*` values, `STAGING_UNIPILE_API_KEY`, `STAGING_R2_PREFLIGHT_VIDEO_URL`, optional `STAGING_APIFY_API_KEY` |
| Authenticated browser checks | `STAGING_E2E_EMAIL`, `STAGING_E2E_PASSWORD`, `STAGING_E2E_PROSPECT_QUERY`, `STAGING_E2E_REVIEW_CAMPAIGN_ID` |
| Synthetic safe journeys | `STAGING_DIRECT_URL`, `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, the controlled staging user credentials, `STAGING_STRIPE_SECRET_KEY`, `STAGING_STRIPE_WEBHOOK_SECRET`, and `STAGING_STRIPE_PRICE_PERSONALIZED_OUTREACH` |
| Release evidence verifier | `STAGING_DIRECT_URL` in the separate `staging-release-canary` GitHub environment |

Do not add values to the repository, workflow output, or command-line logs.
The workflows record a clear skipped result until their required staging secret
set is complete; they do not substitute production credentials or fake targets.
On private repositories, GitHub required-reviewer protection depends on the
account plan. The release canary remains safe without that feature because the
workflow has no provider send capability; the human approval is the deliberate
manual staging delivery described in the release runbook.

## Automated checks

- **Staging provider canary** runs nightly, on relevant trusted `develop`
  changes, and can be started manually. The push trigger is intentional:
  GitHub does not register a newly introduced `workflow_dispatch` workflow
  until it exists on the default branch, so this provides staging evidence
  before any production promotion. It checks out `develop` and invokes the
  shared provider readiness function once.
  It validates Stripe test price IDs, a read-only Unipile account list, R2 MP4
  range playback, and optional Apify connectivity. It archives its structured
  report and does not replace `preflight:production`.
- **Staging functional E2E** runs on relevant trusted `develop` changes,
  waits for API readiness, and extends the existing eight-project Playwright
  matrix. The controlled path signs in, synchronizes channels, runs a
  read-only prospect search, and opens the campaign review gate. It does not
  add a prospect or send outreach.
- **Staging safe journeys** run on the same trusted changes but wait for the
  successful functional E2E result for the exact candidate commit. They
  create run-scoped, synthetic fixtures, create and expire a Stripe test
  Checkout Session, send one signed synthetic `checkout.session.completed`
  webhook plus its duplicate, verify campaign review blocking, and verify the
  retryable video state. They clean up database fixtures and the open Stripe
  session after every run. They never post a video retry, enqueue a worker job,
  or send outreach; the route-level retry queue contract remains covered in CI.
  R2 playback stays in the provider canary so the configured object is probed
  once per scheduled provider check.
- Database and Redis integration tests namespace every created resource with
  `INTEGRATION_TEST_RUN_ID` and remove it after the test. Browser checks create
  no fixtures; their controlled tenant and review campaign are read-only
  staging fixtures.

## Worker rollback rehearsal

Run this once after staging is fully configured, then after material worker
changes. The pause is intentionally state-preserving: do not delete queues,
messages, campaigns, or provider output.

1. Record the current `/ready` response, worker lease timestamps, Better Stack
   heartbeat status, and queue depths.
2. Set `PAUSED_WORKER_FAMILIES=campaign,reconcile,video,analytics,lifecycle`
   on **both** staging API and staging worker services.
3. Redeploy the worker first, then the API. Confirm `/health` remains healthy.
   `/ready` may return `503` while all worker families are paused; that is the
   expected signal that the strict readiness dependency is active.
4. Confirm worker logs report the pause and no new delivery work begins. Keep
   the pause brief, then remove `PAUSED_WORKER_FAMILIES` from both services.
5. Redeploy the worker, wait for fresh leases and heartbeats, redeploy the API
   if needed, and verify `/ready` returns `200` before resuming release gates.

For a production incident, use the same sequence against only the affected
family where possible, record the incident evidence, and resume only after the
root cause and recovery behavior are verified.
