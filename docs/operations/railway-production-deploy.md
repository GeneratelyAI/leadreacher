# Railway Production Deployment

LeadReacher deploys the web application and API as separate Railway services
from the same pnpm monorepo. Each service must use its own config-as-code file.
Do not add a repository-root `railway.toml`: Railway applies a root config to
every service and it will override the service-specific dashboard settings.

## Web service

Configure `@leadreacher/web` with:

- Root directory: repository root (leave unset)
- Railway config file: `/apps/web/railway.toml`
- Watch path: `/apps/web/**`

The service builds and starts through the root pnpm workspace. Configure the
public frontend environment variables on this service only.

## API service

Configure `@leadreacher/api` with:

- Root directory: `/apps/api`
- Railway config file: `/apps/api/railway.toml`
- Watch paths: `/apps/api/**` and `/package.json`

Because Railway isolates this root directory, the API config uses `npm` rather
than root-workspace `pnpm --filter` commands. Configure the API environment
variables from [`apps/api/src/config/env.ts`](../../apps/api/src/config/env.ts)
on this service. Set `NODE_ENV=production`.

The pre-deploy command runs `prisma migrate deploy`. Every directory under
`apps/api/prisma/migrations` must contain a committed `migration.sql`; an empty
migration directory makes Prisma reject the deployment.

Railway checks `GET /ready`, which verifies Postgres and Redis. `GET /health`
is the process liveness endpoint.

## Optional worker service

If background processing is split from the API later, create a third service
from the API package and use this start command:

```text
node dist/worker.js
```

Disable worker flags on the API service and enable them only on the worker.
Never run two consumers for the same queues unintentionally.

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
4. Confirm API `GET /health` and `GET /ready` return `200`.
5. Check runtime logs and Sentry for startup or queue failures.
6. Run the safe checks in
   [`production-e2e-runbook.md`](production-e2e-runbook.md).
