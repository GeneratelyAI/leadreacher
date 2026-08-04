# Launch Readiness

## Runtime topology

Deploy the API and worker as separate Railway services from `apps/api`.

- API: `RUNTIME_ROLE=api`, command from `railway.toml`.
- Worker: `RUNTIME_ROLE=worker`, command from `railway.worker.toml`.
- Worker flags may disable a category, but never enable workers in the API service.
- Configure the three Better Stack heartbeat URLs and Sentry DSN on the worker.

## Required production configuration

- Set Stripe mock mode and video mock mode to `false`.
- Configure Supabase, Postgres, Redis, Stripe, Unipile, Apify, Groq, Google, R2, Resend, and Sentry credentials.
- Configure Supabase Auth SMTP with Resend for invitations and password recovery.
- Verify `SUPPORT_EMAIL`, `PRODUCT_EMAIL_FROM`, `APP_URL`, CORS origins, and webhook URLs.
- Keep `LEGAL_ACCEPTANCE_REQUIRED=false` until counsel approves `/terms` and `/privacy`. Then set approved version strings and enable the gate.

## Database and lifecycle

Apply Prisma migrations before deploying application processes. The launch migrations add campaign billing suspension, a durable activity ledger, product-email outbox, export jobs, legal acceptance, and recoverable deletion.

Organization deletion disables access and delivery immediately and schedules purge exactly 30 days later. The maintenance worker processes exports, product email, and expired purges. Owners can recover before `purgeAt`.

## Release gate

The GitHub Actions workflow validates Prisma, runs API/web lint and tests, builds both applications, audits production dependencies, and optionally checks migration status against `CI_DIRECT_URL`.

Before production launch, also verify:

1. API health and all worker heartbeats alert correctly.
2. Stripe and Unipile staging smoke tests pass.
3. A staging campaign reaches a real inbound reply and an operator reply.
4. Billing interruption pauses delivery and recovery resumes only billing-suspended campaigns.
5. Export download and deletion recovery work for an owner and remain organization-isolated.
6. Paid Google video and Apify tests are run intentionally with sufficient provider capacity.
7. Legal pages are approved and production provider quotas are active.
