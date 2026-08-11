# Onboarding Implementation Map

Use this document to implement or modify any first-time setup component. It
maps each user-visible step to the exact current frontend owner, backend owner,
durable data, transitions, and tests.

## Non-negotiable product boundary

Connecting a channel never sends outreach. The final **Finish setup and review**
action creates the first campaign in review state; launch remains an explicit
dashboard action after every enrolled prospect and the sequence are approved.

Completing the flow means the organization has strategy, a campaign type,
mandatory video configuration, an active Stripe subscription, and at least one
connected delivery channel. The completion action enrolls the exact prospects
persisted by audience analysis in one Strategy-linked review campaign and then
opens `/dashboard/prospects?reviewStatus=pending`. It does not approve prospects,
queue jobs, or send outreach.

Connecting LinkedIn does not send a connection invite, chat message, or video.

## Runtime entry points

| Responsibility | Current file | Notes |
| --- | --- | --- |
| Protected server entry and canonical resume redirect | `apps/web/src/app/onboarding/page.tsx` | Reads `step` and `substep`, bootstraps the organization, redirects completed orgs to `/dashboard`. |
| Client step switcher | `apps/web/src/components/onboarding/Flow.tsx` | Renders exactly one step component. Do not add a second route per step. |
| Shared chrome | `apps/web/src/components/onboarding/Chrome.tsx` | Logo, six-step progress, theme toggle only. |
| Stepper state | `apps/web/src/components/onboarding/Stepper.tsx` | Reads the same step value as the rendered step. |
| Step transitions | `apps/web/src/components/onboarding/StepTransition.tsx` | Preserves reduced-motion behavior. |
| Query helpers and allowed values | `apps/web/src/components/onboarding/steps/steps.ts` | The only place to add a top-level step or Strategy substep. |
| Resume decision | `apps/web/src/lib/onboarding-progress.ts` | Persisted Strategy and subscription data determine the safe default. |

## Route contract

```text
/onboarding?step=discovery
/onboarding?step=strategy&substep=how-it-works
/onboarding?step=strategy&substep=targeting
/onboarding?step=strategy&substep=channels
/onboarding?step=campaign-type
/onboarding?step=video-decision
/onboarding?step=checkout
/onboarding?step=channels
```

Allowed top-level steps, in display and progression order:

1. `discovery`
2. `strategy`
3. `campaign-type`
4. `video-decision`
5. `checkout`
6. `channels`

Do not use local React state as the durable owner of a step. Move forward and
back with `router.push(onboardingHref(...))` or `router.push(strategyHref(...))`.
The server will redirect malformed or stale URLs to a canonical safe location.

## Resume decision table

| Persisted state | Canonical location |
| --- | --- |
| No Strategy record | Discovery |
| Strategy exists, audience analysis incomplete | Strategy / `how-it-works` |
| Audience analysis complete, no campaign type | Campaign Type |
| Campaign type set, no video config | Video Decision |
| Video config set, subscription not active | Checkout |
| Subscription active | Channels |
| `Organization.onboardedAt` set | `/dashboard`, never onboarding |

The implementation is `resolveOnboardingResumeTarget()` in
`apps/web/src/lib/onboarding-progress.ts`. Extend this function and its tests
when a new persisted completion requirement is introduced.

## Step implementation table

| Step | Frontend owner | Current API surface | Durable outputs | Required next transition |
| --- | --- | --- | --- | --- |
| Discovery | `steps/Discovery.tsx` | `/discovery/scrape`, `/discovery/scrape-status`, `/discovery/summary`, `/discovery/complete` | Website-derived Discovery context and initial Strategy record | `strategyHref("how-it-works")` |
| Strategy | `steps/Strategy.tsx` | `GET /strategy/:orgId`, `POST /strategy/generate` | ICP, positioning, audience analysis, channel recommendations | Campaign Type |
| Campaign Type | `steps/CampaignType.tsx` | `PATCH /strategy/:orgId/campaign-type` | `Strategy.campaignType` | Video Decision |
| Video Decision | `steps/VideoDecision.tsx` plus `steps/video-decision/*` | `PATCH /strategy/:orgId/video-decision`, outreach-message and upload endpoints | `Strategy.videoConfig`, message/CTA, and generated or uploaded-media selection | Checkout |
| Checkout | `steps/Checkout.tsx` | `GET /billing/pricing`, `POST /billing/checkout-session` | Stripe checkout session. Entitlement is finalized by webhook. | Channels after verified active state |
| Channels | `steps/Channels.tsx` | `GET /social-accounts`, `POST /social-accounts/connect`, `POST /social-accounts/sync`, `POST /onboarding/complete` | Active `SocialAccount`, enrolled strategy prospects, one Strategy-linked review campaign, then `Organization.onboardedAt` | `/dashboard/prospects?reviewStatus=pending` |

All of these API routes are protected and must derive ownership from the JWT
organization. An `orgId` in a route parameter is a scoped lookup constraint,
not authorization by itself.

## Step-specific implementation rules

### Discovery

- The website URL is initially held in browser storage for landing-page and
  anonymous-scrape handoff only. Scrape results must be URL and organization
  scoped before displaying them.
- `DiscoveryBootstrapBridge` in `Flow.tsx` claims an anonymous
  scrape after authentication. Do not remove the handoff merely to clear local
  storage.
- If no URL is available, `Discovery` displays its in-step website gate.
  It writes a cleaned domain using `apps/web/src/lib/website-url.ts` and then
  starts the existing scrape flow.
- Missing or failed scrape data must show an explicit state. Never write
  invented market, audience, or offer text into Strategy.

### Strategy

- Strategy has three route-driven substeps: `how-it-works`, `targeting`, and
  `channels`.
- The first screen may trigger generation only when the persisted Strategy does
  not already contain completed audience analysis. Refreshing or deep-linking
  must reuse existing data, not spend on a second analysis.
- Company and profile data can be partial. Preserve unavailable/skipped states
  instead of converting them into plausible counts.

### Campaign Type

- Supported campaign types are controlled by the backend billing/Strategy
  schema. Do not hardcode a divergent list in the UI.
- Selection persists through `PATCH /strategy/:orgId/campaign-type` before
  navigation. The UI should stay on the step and surface the API error if that
  write fails.

### Video Decision

- Video is mandatory for every campaign type. The UI must not reintroduce an
  “include video” toggle.
- `personalized_outreach` uses `mode: "personalized"`, generated source, and a
  selected tone. It renders `MessageReview`, `PersonalizedVideo`, and `ToneGrid`.
- `ai_video_ad` uses `mode: "standardized"`, generated source, and a selected
  tone. It renders `MessageReview`, `AiCampaignVideo`, and `ToneGrid`.
- `uploaded_video` renders `MessageReview` plus `UploadedVideo`. Its upload
  validation remains independent from generated-video rules.
- Generated outreach copy comes from the persisted Strategy and must retain
  exactly one `{{FirstName}}` and one `{{Company}}` placeholder. User edits are
  saved via `PATCH /strategy/:orgId/outreach-message`.
- A missing video thumbnail is an intentional neutral gray media area, not a
  fake preview image or a collapsed card.

### Checkout

- The checkout screen can create a Stripe Checkout session. A successful
  browser redirect is not proof that billing is active.
- `Organization.subscriptionStatus`, updated by Stripe webhook handling, is the
  sole entitlement authority. Do not change it from a frontend callback.
- Pricing must be built from the persisted campaign type and mandatory video
  configuration. Never trust a price or entitlement returned from browser-only
  state.

### Channels and completion

- All five channels (LinkedIn, WhatsApp, Instagram, Gmail, Outlook) use hosted
  Unipile authorization; the connection action only opens the provider flow
  and records/syncs an account. LinkedIn is the only required channel.
- Gmail and Outlook are shown as separate rows to match the dashboard's
  connect picker, but Unipile normalizes both to the same `email` platform
  server-side - there is no way to tell them apart once connected, so
  connecting either marks both rows "Connected." This is intentional; do not
  "fix" it by inventing a client-side distinction the backend doesn't have.
- A channel shows a "Recommended" badge when the Strategy generated earlier in
  onboarding recommends it (via `getChannelRecommendations` in
  `apps/web/src/lib/onboarding/channel-recommendations.ts`). Instagram is
  never recommended since the current strategy model doesn't score it.
- `POST /onboarding/complete` should only be called when the required channel
  condition is satisfied. On success, it idempotently creates one Strategy-linked
  campaign in `review`, enrolls the strategy's persisted prospect set without
  approving it, sets `Organization.onboardedAt`, and navigates to pending prospect
  review in the dashboard.
- A retry must reuse the existing onboarding campaign and must not duplicate
  campaign enrollments. It never queues step-zero jobs.

## API request discipline

- Browser code must call `apiFetch()` from `apps/web/src/lib/api.ts`.
- JSON bodies are explicit, and `apiFetch` adds the Supabase bearer token.
- Loading and error states remain visible if a request fails. Do not navigate
  optimistically past a failed persisted write.
- Server components use `bootstrapOrganizationServer()` and
  `getStrategyServer()` from `apps/web/src/lib/api/server.ts`.

## Tests to extend

| Behavior | Preferred test location |
| --- | --- |
| URL-step validation and resume target | `apps/web/src/lib/__tests__/onboarding-progress.test.ts` or the existing closest test |
| Step animation and reduced motion | `apps/web/src/components/onboarding/__tests__/StepTransition.test.ts` |
| Discovery status, anonymous claim, scrape boundaries | `apps/api/src/routes/__tests__/discovery-*.test.ts` |
| Strategy decisions, generation, messages, video | `apps/api/src/routes/__tests__/strategy-*.test.ts` |
| Billing and Stripe lifecycle | `apps/api/src/routes/__tests__/billing.test.ts` and `stripe-webhook.test.ts` |
| Channel completion and hosted authorization | `apps/api/src/routes/__tests__/onboarding-channels.test.ts` and `unipile-hosted-auth.test.ts` |

## Definition of done for an onboarding component

1. The component reads only the canonical route state and persisted API data.
2. It supports loading, empty, error, retry, and success states appropriate to
   the operation.
3. It persists the decision before advancing.
4. It leaves a refresh or back/forward navigation on the same safe state.
5. Onboarding never launches the campaign. Dashboard prospect approval,
   sequence review, and an explicit Launch action are required before delivery.
6. Its API route tests and web typecheck/build pass.
