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

## Operator verification

1. Create a draft campaign with a connected staging sender and at least one
   approved prospect.
2. Confirm the campaign is blocked until its sequence is reviewed where the
   onboarding contract requires it.
3. For a generated video campaign, deliberately use the mock provider or a
   staging provider quota to verify that a failed/review-required video shows
   `Retry generation` in the campaign detail view.
4. Retry once and confirm the UI changes to `Generating`; campaign and outreach
   status must remain unchanged.
5. Verify an inbound webhook marks the associated conversation as needing a
   reply, without dispatching an automated response.
6. Only after a human operator approves it, run one real outbound delivery from
   the dedicated test account and verify the audit trail.

## Rollback

If delivery, worker, or provider failures appear, first disable the relevant
`ENABLE_*_WORKER` flag on the worker service. This stops new work without
removing campaigns, messages, or existing provider output. Investigate Sentry
and Better Stack before enabling it again.
