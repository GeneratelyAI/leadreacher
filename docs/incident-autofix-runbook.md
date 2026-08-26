# Incident autofix runbook

The incident autofix pipeline accepts authenticated Sentry and Better Stack webhooks, stores only sanitized diagnostic context, and opens bounded repair pull requests against `develop`. It never pushes a repair directly to `develop` or `main`.

## Rollout

1. Apply the Prisma migration.
2. Configure API and worker variables with `INCIDENT_AUTOFIX_ENABLED=false`, `INCIDENT_AUTOFIX_DRY_RUN=true`, `INCIDENT_AUTOFIX_AUTO_MERGE=false`, and `ENABLE_INCIDENT_AUTOFIX_WORKER=false`.
3. Add long random values for `SENTRY_WEBHOOK_SECRET`, `BETTERSTACK_WEBHOOK_SECRET`, and `INCIDENT_AUTOFIX_CALLBACK_SECRET`. Configure the providers to send `X-LeadReacher-Webhook-Secret` with their corresponding value.
4. Configure `GITHUB_AUTOFIX_TOKEN` in Railway and the matching `INCIDENT_AUTOFIX_GITHUB_TOKEN` repository secret. The fine-grained token needs contents and pull-request write access only.
5. Add GitHub secrets `OPENAI_API_KEY`, `INCIDENT_AUTOFIX_API_BASE_URL`, and `INCIDENT_AUTOFIX_CALLBACK_SECRET`.
6. Enable the API flag, then the worker flag. Keep dry-run and auto-merge disabled until webhook ingestion, deduplication, pull-request creation, CI, and ChatGPT briefs have been observed safely.
7. Enable auto-merge only after branch protection requires CI on repair pull requests. Deployment smoke and the staging suites run after merge and provide the two independent verification signals.

Provider endpoints:

- `POST /webhooks/incidents/sentry`
- `POST /webhooks/incidents/better-stack`

Both endpoints reject missing or incorrect secrets, cap requests at 256 KiB, redact common credentials and personal identifiers, and deduplicate by provider issue and release.

## Policy

Automated repair is limited to eight files and 350 changed lines. It must include a regression test. Changes to workflows, schema/migrations, dependencies, authentication, billing, encryption, infrastructure, lockfiles, and file deletions are blocked. Only low-risk repairs may be configured for auto-merge; every other repair requires review.

Two independent successful staging signals are required before a repair is marked verified. A recovered alert cancels repair work that has not yet opened a pull request.

## Operations

- Retry: `POST /internal/incident-autofix/:id/retry`
- Cancel: `POST /internal/incident-autofix/:id/cancel`
- Pending ChatGPT briefs: `GET /internal/incident-autofix/unbriefed`

Internal endpoints require `X-LeadReacher-Autofix-Secret`. Rotate the callback and provider webhook secrets immediately if either is disclosed. Disable `INCIDENT_AUTOFIX_ENABLED` to stop new ingestion; disable the worker flag to stop dispatch while retaining incident records.
