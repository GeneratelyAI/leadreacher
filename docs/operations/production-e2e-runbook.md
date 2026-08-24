# Production E2E Runbook

Use this runbook against a staging workspace before a production rollout. It
does not require Apify and it does not send LinkedIn messages unless an
operator explicitly reaches the final delivery step.

## Safe automated checks

```bash
# From the repository root: API unit and route contracts
pnpm --filter @leadreacher/api exec vitest run

# Web type and production build
pnpm --filter @leadreacher/web exec tsc --noEmit
pnpm --filter @leadreacher/web build

# Authenticated read-only dashboard load test
AUTH_TOKEN="<staging Supabase JWT>" BASE_URL="https://<staging-api>" \
  k6 run apps/api/scripts/load-test.js
```

The load test calls only liveness/readiness and read-only dashboard endpoints.
It does not scrape, create campaigns, send outreach, or generate video.

The GitHub workflows add repeatable evidence around this runbook:

| Gate | Evidence | Outbound behavior |
| --- | --- | --- |
| CI delivery integration | Real Postgres and Redis test fixtures validate idempotent attempt reservation, unknown-send recovery claims, repeated webhooks, and manual-send uniqueness. Fixtures are namespaced and cleaned up. | None |
| Staging provider canary | One shared read-only Stripe test-mode, Unipile, R2, and optional Apify check. It wraps the reusable provider function once and does not call or replace production preflight. | None |
| Staging functional E2E | Extends `authenticated-responsive.spec.ts` and its existing eight-device route matrix with sign-in, channel sync state, prospect discovery, and campaign-review checks. | None |
| Staging safe journeys | Creates run-scoped fixtures, creates and expires a Stripe test Checkout Session, verifies a signed duplicate webhook, verifies the campaign review gate, and reads a retryable video state. Database and Stripe fixtures are removed after every run. | None; it does not post a video retry or enqueue a worker job. |
| Release LinkedIn canary verifier | Reads durable staging delivery and inbound reconciliation evidence after a human has already completed the one allowed controlled delivery. | None |

The unit and route suites cover Stripe webhook, campaign review, video retry
queue, and R2 byte-range contracts. Staging safe journeys make the safe Stripe,
review-gate, and retry-state paths evidence-producing against the deployed
candidate. The provider canary remains the single read-only R2 probe and does
not create a checkout, campaign, video, or outreach message.

## Production preflight

Run this with the production API environment before accepting a deployment:

```bash
pnpm --filter @leadreacher/api preflight:production
```

It validates live Stripe prices, a read-only Unipile account list, and an R2
public MP4 range response. It requires `R2_PREFLIGHT_VIDEO_URL` and does not
send outreach. Record the command output and `GET /ready` response as release
evidence.

## Operator verification

1. Confirm **Staging safe journeys** passed for the deployed candidate. It
   creates and expires an isolated Stripe test Checkout Session and proves
   signed webhook idempotency; separately complete Checkout and confirm billing
   interruption, recovery, and portal access using an internal customer.
2. Create a draft campaign with a connected staging sender and at least one
   approved prospect.
3. The automated journey verifies the synthetic campaign review gate. Confirm
   the campaign is also blocked until its audience and sequence are reviewed
   where the onboarding contract requires it.
4. For a generated video campaign, deliberately use the mock provider or a
   staging provider quota to verify that a failed/review-required video shows
   `Retry generation` in the campaign detail view.
5. The automated journey verifies that retryable state without queuing work.
   Retry once manually and confirm the UI changes to `Generating`; campaign and
   outreach status must remain unchanged.
6. Verify the stored R2 MP4 plays inline in the dashboard with byte-range
   requests, then verify an inbound webhook marks the associated conversation as needing a
   reply, without dispatching an automated response.
7. Only after a human operator approves it, run one real outbound delivery from
   the dedicated test account and verify the audit trail.

## Release-triggered LinkedIn canary

This is a release gate, not a weekly scheduled test. It validates the exact
`develop` commit deployed to staging; a calendar-scheduled delivery could test
an unchanged build and provide no promotion evidence.

1. Confirm CI, deployment smoke, and the nightly/manual **Staging provider
   canary** passed for the exact staging release candidate.
2. From the protected production operator environment, run
   `pnpm --filter @leadreacher/api preflight:production`. This remains the
   protected live-provider command and must reject application mock modes.
3. In Railway, confirm staging is deployed at the intended `develop` commit.
   Record that SHA in the release ticket.
4. A release owner performs the existing single controlled LinkedIn delivery
   from the dedicated staging sender to the controlled staging recipient. This
   is the only outbound test and is not initiated by GitHub Actions.
5. Wait for the outbound `ManualDeliveryAttempt` to be durable and for the
   controlled inbound response to reconcile. Record only the attempt ID, not
   message content or provider credentials, in the release ticket.
6. Manually dispatch **Staging release LinkedIn canary** with the exact SHA
   reachable from `develop`,
   `ManualDeliveryAttempt` ID, expected campaign state, and the inbound
   reconciliation requirement. The staging-release-canary environment should
   require a release-owner approval where the repository plan supports that
   protection. The workflow reads the database and
   archives a report verifying attempt state, provider reference consistency,
   campaign/lead association, campaign state, and inbound reconciliation.
7. Attach the artifact to the promotion evidence, then open the reviewed
   `develop` to `main` pull request. Do not promote when the report is missing
   or incomplete.

## Rollback

If delivery, worker, or provider failures appear, set
`PAUSED_WORKER_FAMILIES` on both API and worker services to the required
comma-separated family (`campaign`, `reconcile`, `video`, `analytics`, or
`lifecycle`) and redeploy the worker followed by the API. This pauses new work
without deleting campaigns, messages, or existing provider output. `/health`
should remain available; `/ready` can return `503` while a required worker lease
is intentionally paused. Record the affected queues, pause time, Sentry
incident, and Better Stack heartbeat. After the rollback or investigation,
remove only the needed pause values, redeploy the worker, wait for fresh leases
and heartbeats, then verify API `/ready` returns `200` before reopening traffic.
Do not roll back by deleting Redis queues or campaign state.

Configure Better Stack/Sentry alerts for API readiness failures, missing worker
heartbeats, worker restarts, queue failures, stale queued jobs, failed delivery
reconciliation, and webhook failure spikes.
