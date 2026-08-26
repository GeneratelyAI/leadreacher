# Incident autofix runbook

The incident autofix pipeline accepts authenticated Sentry and Better Stack webhooks, stores only sanitized diagnostic context, and opens bounded repair pull requests against `develop`. Repairs run in a scheduled Codex project task authenticated by the owner's ChatGPT subscription. It never pushes a repair directly to `develop` or `main`, and it does not require an OpenAI API key.

## Rollout

1. Apply the Prisma migration.
2. Configure API and worker variables with `INCIDENT_AUTOFIX_ENABLED=false`, `INCIDENT_AUTOFIX_DRY_RUN=true`, `INCIDENT_AUTOFIX_AUTO_MERGE=false`, and `ENABLE_INCIDENT_AUTOFIX_WORKER=false`.
3. Set `SENTRY_WEBHOOK_SECRET` to the Client Secret from the Sentry internal integration. Sentry signs each JSON payload in `Sentry-Hook-Signature` with HMAC-SHA256; the API verifies that signature before ingestion. Add long random values for `BETTERSTACK_WEBHOOK_SECRET` and `INCIDENT_AUTOFIX_CALLBACK_SECRET`, and configure Better Stack to send its value in `X-LeadReacher-Webhook-Secret`.
4. Keep the Codex desktop host signed in to ChatGPT and GitHub, with Railway CLI access to the LeadReacher project. The scheduled project task uses those user sessions and runs in a fresh Codex worktree.
5. Add GitHub secrets `INCIDENT_AUTOFIX_API_BASE_URL` and `INCIDENT_AUTOFIX_CALLBACK_SECRET` for the post-merge verification workflows. Do not add `OPENAI_API_KEY`; the repair task consumes the owner's Codex subscription.
6. Enable the API flag, then the worker flag. Keep auto-merge disabled until webhook ingestion, deduplication, pull-request creation, CI, and ChatGPT briefs have been observed safely.
7. Enable auto-merge only after branch protection requires CI on repair pull requests. Deployment smoke and the staging suites run after merge and provide the two independent verification signals.

Provider endpoints:

- `POST /webhooks/incidents/sentry`
- `POST /webhooks/incidents/better-stack`

Both endpoints reject missing or incorrect secrets, cap requests at 256 KiB, redact common credentials and personal identifiers, and deduplicate by provider issue and release.

## Policy

Automated repair is limited to eight files and 350 changed lines. It must include a regression test. Changes to workflows, schema/migrations, dependencies, authentication, billing, encryption, infrastructure, lockfiles, and file deletions are blocked. Only low-risk repairs may be configured for auto-merge; every other repair requires review.

The scheduled Codex task claims at most one repair per run. A claim is available again only when a previous run has remained incomplete for 90 minutes, which prevents overlapping tasks while allowing recovery after a host interruption. Incident payloads remain untrusted evidence and are never inserted into shell commands or treated as instructions.

Two independent successful staging signals are required before a repair is marked verified. A recovered alert cancels repair work that has not yet opened a pull request.

## Operations

- Retry: `POST /internal/incident-autofix/:id/retry`
- Cancel: `POST /internal/incident-autofix/:id/cancel`
- Repairs ready for the subscription runner: `GET /internal/incident-autofix/pending`
- Atomic subscription-runner claim: `POST /internal/incident-autofix/:id/claim`
- Pending ChatGPT briefs: `GET /internal/incident-autofix/unbriefed`

Internal endpoints require `X-LeadReacher-Autofix-Secret`. Rotate the callback and provider webhook secrets immediately if either is disclosed. Disable `INCIDENT_AUTOFIX_ENABLED` to stop new ingestion; disable the worker flag or pause the Codex automation to stop repair preparation or execution while retaining incident records.
