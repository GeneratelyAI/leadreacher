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

1. Complete Stripe Checkout and confirm signed webhook activation, billing
   interruption, recovery, and portal access using an internal customer.
2. Create a draft campaign with a connected staging sender and at least one
   approved prospect.
3. Confirm the campaign is blocked until its sequence is reviewed where the
   onboarding contract requires it.
4. For a generated video campaign, deliberately use the mock provider or a
   staging provider quota to verify that a failed/review-required video shows
   `Retry generation` in the campaign detail view.
5. Retry once and confirm the UI changes to `Generating`; campaign and outreach
   status must remain unchanged.
6. Verify the stored R2 MP4 plays inline in the dashboard with byte-range
   requests, then verify an inbound webhook marks the associated conversation as needing a
   reply, without dispatching an automated response.
7. Only after a human operator approves it, run one real outbound delivery from
   the dedicated test account and verify the audit trail.

## Rollback

If delivery, worker, or provider failures appear, set
`PAUSED_WORKER_FAMILIES` on both API and worker services to the required
comma-separated family (`campaign`, `reconcile`, `video`, `analytics`, or
`lifecycle`) and redeploy. This pauses new work without deleting campaigns,
messages, or existing provider output. Record the affected queues, pause time,
Sentry incident, and Better Stack heartbeat before removing the pause. Do not
roll back by deleting Redis queues or campaign state.

Configure Better Stack/Sentry alerts for API readiness failures, missing worker
heartbeats, worker restarts, queue failures, stale queued jobs, failed delivery
reconciliation, and webhook failure spikes.
