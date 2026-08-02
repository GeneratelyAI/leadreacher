# Railway Production Deployment

LeadReacher runs as two Railway services from the same repository. The API
accepts HTTP traffic. The worker consumes BullMQ jobs and must not expose a
public endpoint.

## API service

Use the repository-level [`railway.toml`](../../railway.toml). Configure the
service with the standard API environment variables from
[`apps/api/src/config/env.ts`](../../apps/api/src/config/env.ts), plus:

```dotenv
NODE_ENV=production
ENABLE_CAMPAIGN_WORKER=false
ENABLE_RECONCILE_WORKER=false
ENABLE_VIDEO_WORKER=false
ENABLE_ANALYTICS_INSIGHTS_WORKER=false
```

Set Railway health checks to `GET /ready`. This probe verifies Postgres and
Redis; it is intentionally not rate-limited and is never cached.

## Worker service

Create a second service from the same repository. Reuse the API service’s
secrets, then override its start command and worker flags:

```text
pnpm --filter @leadreacher/api worker
```

```dotenv
NODE_ENV=production
ENABLE_CAMPAIGN_WORKER=true
ENABLE_RECONCILE_WORKER=true
ENABLE_VIDEO_WORKER=true
ENABLE_ANALYTICS_INSIGHTS_WORKER=true
```

The worker uses the same `buildServer()` lifecycle but never calls
`listen()`. Better Stack heartbeats and Sentry queue-failure events are active
when their existing environment variables are configured.

## Video prerequisites

Before enabling the video worker, provide the selected provider credential,
the TTS credential for personalized videos, and all Cloudflare R2 credentials.
Keep `VIDEO_MOCK_MODE=false` in production. Do not enable a video worker until
the provider key, TTS key, and R2 bucket have been tested in a non-production
environment.

## Rollout checks

1. Deploy the API with all worker flags disabled.
2. Confirm `GET /health` and `GET /ready` return `200`.
3. Deploy the worker and confirm its startup log says `Background workers started`.
4. Check Better Stack heartbeats and Sentry for queue failures.
5. Run the safe checks in [`production-e2e-runbook.md`](production-e2e-runbook.md).

Never run API and worker services with the same worker flag enabled. That would
cause duplicate queue consumers and makes production behavior harder to reason
about.
