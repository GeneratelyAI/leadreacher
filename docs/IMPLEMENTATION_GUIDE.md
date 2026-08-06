# AI Implementation Guide

This document is the execution contract for an AI agent changing LeadReacher.
It complements, but does not replace, the component and API source files. Read
the linked implementation map for the product area before making a change.

## Documentation map

| Area | Read before editing |
| --- | --- |
| First-time setup | [Onboarding implementation map](onboarding/implementation-map.md) |
| Daily workspace | [Dashboard implementation map](dashboard/implementation-map.md) |
| Product boundaries | [Product vision](product/product-vision.md) |
| System ownership and external providers | [System architecture](architecture/system-design.md) |
| Credentials and provider custody | [Credential storage](architecture/security-credential-storage.md) |

## Source-of-truth order

When documentation and code disagree, use this order:

1. Prisma schema and current API route validation define persisted and accepted
   data.
2. Existing automated tests define currently protected behavior.
3. The relevant implementation map defines intended ownership, UX rules, and
   verification scope.
4. Product-area documentation defines product intent.

Do not silently make code match an older document. Update the document in the
same change when the intended product behavior changes.

## Working contract

Before editing:

1. Read `AGENTS.md` and the target implementation map.
2. Inspect the current file and its direct consumers with `rg`.
3. Identify the durable source of truth. Browser state is never the source of
   truth for organization, billing, campaign, channel, or delivery state.
4. State whether the work is implemented behavior, a planned extension, or a
   bug fix. Do not promote planned behavior to active UI merely because a
   sidebar item exists.

While editing:

- Keep an API query organization-scoped through the authenticated `orgId`.
- Reuse `apiFetch` for authenticated browser requests and preserve its error
  handling. Do not add raw fetch calls that bypass the access token.
- Use existing onboarding cards, dashboard tokens, `Button`, social logos, and
  Lucide icons. Do not add a second visual system for one screen.
- Preserve loading, empty, error, and partial-data states. A missing metric is
  not permission to fabricate a number, trend, forecast, recommendation, or
  completion state.
- Do not trigger paid providers, external outreach, or a campaign launch from
  a display-only change.
- Preserve focus-visible behavior, semantic headings and landmarks, keyboard
  access, dark mode, and `prefers-reduced-motion` behavior.
- Do not put secrets, tokens, URLs containing credentials, or customer data in
  documentation, fixtures, logs, or commits.

After editing:

1. Run `git diff --check`.
2. Run the verification commands for every application touched.
3. Report changed files, contract changes, tested behavior, and any remaining
   manual or paid-provider validation.

## Routing and state rules

### Authentication and organization bootstrap

- Browser and server code obtain the authenticated Supabase user first.
- The API establishes organization identity through the JWT and protected-route
  middleware. Never trust an organization ID supplied only by the browser.
- `Organization.onboardedAt` is the durable boundary:
  - no value: the organization resumes onboarding;
  - value present: the user belongs in `/dashboard`.
- `/dashboard` redirects unauthenticated visitors to `/login` and incomplete
  organizations to `/onboarding`.
- `/onboarding` redirects completed organizations to `/dashboard`.

### URL state

- Top-level onboarding state belongs in `step`.
- Strategy sub-screen state belongs in `substep`.
- Use the helpers in
  [`apps/web/src/components/onboarding/steps/steps.ts`](../apps/web/src/components/onboarding/steps/steps.ts):
  `onboardingHref()` and `strategyHref()`.
- Server-side resume logic canonicalizes missing or invalid parameters. Do not
  introduce a competing local step store.

### External side effects

| Side effect | Required durable gate |
| --- | --- |
| Website scrape | URL-scoped scrape status and explicit failed state |
| Strategy generation | Existing persisted Strategy data must be reused when present |
| Stripe entitlement | Stripe webhook state on `Organization`, not a checkout redirect |
| Channel connection | Persisted active `SocialAccount` after hosted-auth return and sync |
| Campaign launch | Shared guarded launch service after a valid Campaign and approved prospects. Confirmation is either onboarding's explicit **Finish and launch** action for the first campaign or the dashboard launch action for later campaigns. |
| Outreach send | Existing sequence worker and delivery-reservation safeguards |
| Paid video generation | Durable template/asset state and recovery path |

## Verification commands

Run only the rows relevant to the files changed, then run any focused tests for
the behavior being changed.

| Change area | Required commands |
| --- | --- |
| API TypeScript/routes/services/workers | `cd apps/api && npx vitest run` and `cd apps/api && npx tsc --noEmit` |
| Web TypeScript/components/routes | `cd apps/web && npx tsc --noEmit` and `pnpm --filter @leadreacher/web build` |
| Prisma schema or migration | `cd apps/api && npx prisma generate`, then API typecheck and tests |
| Docs only | `git diff --check` and validate relative Markdown links |

Do not execute a live Apify, Veo, TTS, Unipile, or Stripe charge merely to
verify a code path. Use mocks and existing integration seams unless a human
explicitly requests a paid live run.

## Implementation handoff format

For every non-trivial task, write or report these fields before considering it
complete:

```text
Goal:
Current owner(s):
Durable source of truth:
API contract changed?:
External side effect?:
Files changed:
Automated verification:
Manual verification still required:
```

This format prevents a UI-only change from accidentally changing billing,
campaign delivery, or onboarding completion semantics.
