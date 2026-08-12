# Launch Readiness

## Runtime topology

Deploy web, API, and worker as separate required Railway services.

- API: `RUNTIME_ROLE=api`, command from `railway.toml`.
- Worker: `RUNTIME_ROLE=worker`, command from `railway.worker.toml`.
- Set all worker flags to `true` in production on the worker and `false` on API.
- Configure the three Better Stack heartbeat URLs and Sentry DSN on the worker.
  Campaign, video, and reconciliation are externally heartbeated. Lifecycle is
  owned by reconciliation maintenance; analytics is monitored through its Redis
  lease and the API readiness check rather than a separate heartbeat.
- API readiness returns `503` when Redis, Postgres, or a required worker lease
  is unavailable. Worker leases renew every 30 seconds and expire after 90.

## Required production configuration

- Set Stripe mock mode and video mock mode to `false`.
- Configure Supabase, Postgres, Redis, Stripe, Unipile, Groq, Google, R2,
  Resend, and Sentry credentials. Apify is optional company enrichment only.
- Configure Supabase Auth SMTP with Resend for invitations and password recovery.
- Verify `SUPPORT_EMAIL`, `PRODUCT_EMAIL_FROM`, `APP_URL`, CORS origins, and webhook URLs.
- Keep `LEGAL_ACCEPTANCE_REQUIRED=false` until counsel approves `/terms` and `/privacy`. Then set approved version strings and enable the gate.

## Database and lifecycle

Apply Prisma migrations before deploying application processes. The launch migrations add campaign billing suspension, a durable activity ledger, product-email outbox, export jobs, legal acceptance, and recoverable deletion.

Organization deletion disables access and delivery immediately and schedules purge exactly 30 days later. The maintenance worker processes exports, product email, and expired purges. Owners can recover before `purgeAt`.

## Release gate

The GitHub Actions workflow validates Prisma, runs API/web lint and tests, builds both applications, audits production dependencies, and optionally checks migration status against `CI_DIRECT_URL`.

Before production launch, also verify:

1. API health, the three worker heartbeats, and all five worker leases alert
   correctly. Lifecycle is covered by reconciliation maintenance; analytics is
   covered by its readiness lease.
2. Stripe and Unipile staging smoke tests pass.
3. A staging campaign reaches a real inbound reply and an operator reply.
4. Billing interruption pauses delivery and recovery resumes only billing-suspended campaigns.
5. Export download and deletion recovery work for an owner and remain organization-isolated.
6. Run `pnpm --filter @leadreacher/api preflight:production` with live
   credentials. It is read-only and verifies Stripe prices, Unipile, and R2.
7. Apify quota failure leaves strategy and recommended channels available;
   LinkedIn discovery must continue through Unipile.
8. Legal pages are approved and production provider quotas are active.
