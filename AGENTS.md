# AGENTS.md — LeadReacher

Context file for Cursor and AI agents. Read this before touching any file in the repo.

---

## What this project is

LeadReacher is a multi-channel B2B outreach automation SaaS. It finds leads (via Apify LinkedIn scraper), writes personalized connection notes and follow-up sequences (via Groq's Llama models), and sends them across LinkedIn, WhatsApp, Instagram, and email (via Unipile). Campaigns run on a BullMQ job queue: send invite → wait for acceptance → send follow-up message. Replies come back via Unipile webhooks.

**Co-founders:** Samo Ayoub (business), Nicolas Cantanhede (CTO).
**Backend intern:** Kai ([kaiyue.wei@outlook.com](mailto:kaiyue.wei@outlook.com)) — assigned tasks listed below.
**Repo:** `nickcantanhede/leadreacher` (private, monorepo, Turborepo).

---

## Monorepo structure

```
/
├── apps/
│   ├── api/                          # Fastify backend (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── adapters/              # 10 files as of 2026-07-26, not the 3 below
│   │   │   │   ├── apify.ts          # ApifyAdapter — LinkedIn scraper
│   │   │   │   ├── google-ai.ts      # Veo video generation (submit/poll/fetch)
│   │   │   │   ├── google-omni.ts    # Gemini Omni video generation (alt provider)
│   │   │   │   ├── google-tts.ts     # Text-to-speech for video audio
│   │   │   │   ├── video-provider.ts # Picks veo/omni via VIDEO_GENERATION_PROVIDER
│   │   │   │   ├── r2.ts             # Cloudflare R2 storage
│   │   │   │   ├── linkedin-company-size-codes.ts
│   │   │   │   ├── linkedin-industry-codes.ts
│   │   │   │   ├── unipile.ts        # UnipileAdapter — all social channel I/O, incl. email
│   │   │   │   └── types.ts          # Shared adapter types (UnipileProfile, etc.)
│   │   │   ├── config/
│   │   │   │   └── env.ts            # Zod-validated env schema
│   │   │   ├── lib/
│   │   │   │   ├── errors.ts         # AppError hierarchy (Auth/NotFound/Validation/Forbidden/Conflict/ExternalService)
│   │   │   │   ├── lead-status.ts    # Lead status constants + LeadStatusSchema
│   │   │   │   ├── prisma.ts         # Prisma client singleton
│   │   │   │   ├── queue.ts          # BullMQ queues + job types
│   │   │   │   ├── redis.ts          # Upstash Redis connections
│   │   │   │   └── sequence.ts       # SequenceStep schema + parseSequence()
│   │   │   ├── plugins/
│   │   │   │   ├── auth.ts           # Supabase JWT verification, sets request.orgId
│   │   │   │   ├── prisma.ts         # Fastify Prisma plugin
│   │   │   │   └── protected-routes.ts
│   │   │   ├── routes/                # 13 route files as of 2026-07-26, not the 6 below —
│   │   │   │   │                      # check apps/api/src/routes/ for the current list
│   │   │   │   ├── auth.ts           # POST /auth/signup, /auth/login
│   │   │   │   ├── billing.ts        # Stripe checkout session, billing portal, pricing
│   │   │   │   ├── campaigns.ts      # CRUD + /launch + /leads enrollment
│   │   │   │   ├── dashboard.ts      # /dashboard/* — overview, campaigns, prospects,
│   │   │   │   │                      # messages/conversations/replies, channels, analytics, settings
│   │   │   │   ├── discovery.ts      # /discovery/scrape, scrape-status, summary, complete
│   │   │   │   ├── health.ts         # GET /health
│   │   │   │   ├── leads.ts          # /leads/scrape, /leads/import/csv, CRUD
│   │   │   │   ├── onboarding.ts     # POST /onboarding/complete
│   │   │   │   ├── social-accounts.ts
│   │   │   │   ├── strategy.ts       # /strategy/:orgId, /strategy/generate, campaign-type,
│   │   │   │   │                      # video-decision, outreach-message
│   │   │   │   ├── strategy-filters.ts
│   │   │   │   ├── stripe-webhook.ts # Stripe subscription lifecycle events
│   │   │   │   └── webhooks.ts       # POST /webhooks/unipile
│   │   │   ├── scripts/
│   │   │   │   ├── get-test-token.ts
│   │   │   │   ├── recreate-unipile-webhooks.ts  # Run to reset webhooks
│   │   │   │   └── test-unipile.ts
│   │   │   ├── services/              # 10 files as of 2026-07-26, not the 2 below
│   │   │   │   ├── analytics-insights.ts
│   │   │   │   ├── campaign-channel-accounts.ts
│   │   │   │   ├── campaign-sequence-control.ts
│   │   │   │   ├── campaign-step0-queue.ts
│   │   │   │   ├── campaign-step1-chat.ts  # deliverSequenceStep1ViaChat()
│   │   │   │   ├── deliver-channel-step.ts # per-channel outreach delivery, incl. email via Unipile
│   │   │   │   ├── delivery-attempt.ts
│   │   │   │   ├── lead-import.ts          # importFromCSV(), importScrapedProfiles()
│   │   │   │   ├── operator-message-delivery.ts  # dashboard operator reply send
│   │   │   │   └── personalized-video.ts
│   │   │   ├── types/
│   │   │   │   └── fastify.d.ts      # Adds orgId to FastifyRequest
│   │   │   ├── workers/               # 7 files as of 2026-07-26, not the 1 below
│   │   │   │   ├── analytics-insights.ts
│   │   │   │   ├── campaign-sequence.ts  # BullMQ worker — runs campaign steps
│   │   │   │   ├── reconcile-campaign-enrollments.ts
│   │   │   │   ├── reconcile-delivery-attempts.ts
│   │   │   │   ├── reconcile-maintenance.ts
│   │   │   │   ├── reconcile-relations.ts
│   │   │   │   └── video-generation.ts
│   │   │   ├── index.ts              # Entry point
│   │   │   └── server.ts             # Fastify server setup
│   │   └── prisma/
│   │       └── schema.prisma
│   └── web/                          # Next.js frontend (App Router + TypeScript + Tailwind)
│       └── src/
│           ├── app/                  # Pages
│           ├── components/
│           │   ├── landing/          # Hero, Features, Stats, Waitlist, Footer
│           │   ├── auth/             # AuthForm, AuthPageShell
│           │   └── ui/               # Button, Card, Input, Badge, etc.
│           ├── hooks/
│           │   ├── useHeroVideo.ts   # Video bounce loop at frame 116
│           │   └── useNavbarTheme.ts
│           └── lib/
│               ├── constants/
│               │   ├── animation.ts  # 144 frames, 24fps, bounce start = frame 116
│               │   ├── brand.ts      # Colors, asset paths, footer copy
│               │   └── index.ts
│               └── supabase/         # client.ts + server.ts
└── packages/
    └── shared/                       # Shared types (currently empty export)
```

---

## Tech stack


| Layer                     | Technology                                                             |
| ------------------------- | ---------------------------------------------------------------------- |
| Frontend                  | Next.js (App Router), TypeScript, Tailwind CSS                         |
| Backend                   | Fastify, TypeScript                                                    |
| Database                  | Supabase (Postgres) + Prisma ORM                                       |
| Queue                     | BullMQ + Upstash Redis                                                 |
| Outreach channels         | Unipile (LinkedIn, WhatsApp, Instagram, Facebook, email)               |
| Lead scraping             | Apify actor `harvestapi~linkedin-profile-search`                       |
| Lead enrichment           | Firecrawl — company website → markdown, feeds Discovery and enrichment (`apps/api/src/lib/firecrawl.ts`) |
| AI (sequences + strategy) | Groq (`llama-3.1-8b-instant` text, `meta-llama/llama-4-scout-17b-16e-instruct` vision) — see `apps/api/src/lib/groq.ts`. No Anthropic SDK dependency exists in the API. |
| AI video                  | Google, configurable via `VIDEO_GENERATION_PROVIDER`: Veo (`google-ai.ts`) or Gemini Omni (`google-omni.ts`), plus `google-tts.ts` for audio |
| Video storage             | Cloudflare R2                                                          |
| Payments                  | Stripe — fully integrated (checkout sessions, billing portal, webhook-driven subscription sync, full pricing catalog, mock mode) |
| Frontend hosting          | Vercel                                                                 |
| Backend hosting           | Railway                                                                |
| Tunnel (dev)              | ngrok stable domain: `https://antler-concert-unluckily.ngrok-free.dev` |


---

## Environment variables (apps/api/.env)

Validated by Zod in `src/config/env.ts`. All required or server crashes at startup.

```
PORT=
DATABASE_URL=                   # Supabase Postgres connection string
DIRECT_URL=                     # Supabase direct URL (for Prisma migrations)
SUPABASE_URL=
UNIPILE_DSN=api49.unipile.com:17966
UNIPILE_API_KEY=
UNIPILE_WEBHOOK_SECRET=67566c83615ee686c985dc172b82f1d51b8b26a460ffbbe9d2c2a25cc3701478
APIFY_API_KEY=                  # Note: env.ts uses APIFY_API_KEY (not APIFY_API_TOKEN)
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
CORS_ORIGIN=http://localhost:3000
ENABLE_API_DOCS=                # optional; default on when NODE_ENV !== production
```

### API docs (Scalar + OpenAPI)

- Local UI: `http://localhost:<PORT>/docs` (Scalar)
- OpenAPI JSON: `http://localhost:<PORT>/documentation/json`
- Docs are **on by default outside production**. Set `ENABLE_API_DOCS=false` to disable, or `ENABLE_API_DOCS=true` to force on.
- In Scalar, set the Bearer token to a Supabase JWT for protected routes. Do not call Unipile/Stripe webhooks from Scalar.
- Route contracts live on Fastify `schema` objects (Zod via `fastify-type-provider-zod`). Prefer request schemas + tags/summary; avoid `z.any()` in Fastify schemas.

---

## Prisma schema — key models

```
Organization   id, name, supabaseOrgId, plan, onboardingData, onboardedAt
User           id, supabaseId, email, name, orgId, role
Integration    id, orgId, provider, encryptedCredentials, status  ← AES-256-GCM encrypted creds
Strategy       id, orgId, icpDefinition, positioning, channels, messagingAngles, executionPlan
Campaign       id, orgId, name, status(draft/review/active/paused/completed), channels[], sequence(JSON)
Lead           id, orgId, source, firstName, lastName, company, title, status, providerLinkedinId, linkedinUrl
CampaignLead   id, campaignId, leadId, currentStep, linkedinChatId(unique), status(active/completed/replied/skipped)
Message        id, campaignId, leadId, orgId, channel, content(JSON), direction(inbound/outbound), status, externalId, stepIndex
SocialAccount  id, orgId, platform, platformUserId, unipileId, accountName, status
VideoAsset     id, orgId, campaignId, status, videoUrl(R2), generation(1-3), criticScore
AuditLog       id, orgId, userId, action, resource, resourceId
PipelineRun    id, orgId, agentName, input, output, status
Waitlist       id, email
```

---

## Campaign sequence flow

```
POST /campaigns/:id/launch
  → campaignSequenceQueue.addBulk() — one job per CampaignLead at step=0

Worker picks up step=0:
  → adapter.getProfile(accountId, linkedinPublicId)
      If FIRST_DEGREE (already connected):
        → deliverSequenceStep1ViaChat() [skip invite]
      Else:
        → adapter.sendConnectionInvite()
        → lead.status = 'contacted'
        → campaignLead.currentStep = 1
        → WAIT for new_relation webhook

Webhook: new_relation fires:
  → match Lead by providerLinkedinId
  → lead.status = 'connected'
  → deliverSequenceStep1ViaChat()

deliverSequenceStep1ViaChat():
  → adapter.startChat(unipileAccountId, attendeeProviderId, step1.message)
  → campaignLead.linkedinChatId = chat.chat_id (unique constraint = idempotency guard)
  → campaignLead.currentStep = 2
  → enqueue step=2 with delay

Worker picks up step=2+:
  → adapter.sendMessageToChat(chatId, message)
  → enqueue next step with delay

Webhook: message_received fires:
  → direction check: sender.attendee_provider_id === account_info.user_id → outbound (skip)
  → match CampaignLead by linkedinChatId
  → all messages → status 'replied'
  → lead.status = 'replied'
  → campaignLead.status = 'replied'
  → cancelPendingSequenceJobs() — removes all future BullMQ steps
  → create inbound Message record
```

---

## Sequence format

Stored as JSON in `Campaign.sequence`. Validated by `parseSequence()`.

```ts
type SequenceStep = {
  type: string;       // e.g. 'linkedin_invite', 'linkedin_message'
  message: string;    // required, non-empty
  delayHours: number; // delay before this step runs (step 0 = immediate)
};
```

Campaign sequence must be a non-empty array of SequenceStep. Step 0 = invite, Step 1 = first message after connect, Step 2+ = follow-ups.

---

## Unipile integration — critical details

**Auth:** `Unipile-Auth` header. NOT HMAC. Value equals `UNIPILE_WEBHOOK_SECRET` set at webhook creation.

Verification (in `webhooks.ts`):

```ts
crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
```

**Webhooks** (registered via `scripts/recreate-unipile-webhooks.ts`):

- `leadreacher-messaging` → source: `"messaging"`, events: `["message_received"]`
- `leadreacher-relations` → source: `"users"`, events: `["new_relation"]`

`**new_relation` payload** (actual Unipile schema — confirmed empirically):

```ts
{
  event: "new_relation",
  account_id: string,
  account_type: string,
  webhook_name: string,
  user_full_name: string,
  user_provider_id: string,        // use this to match Lead.providerLinkedinId
  user_public_identifier: string,
  user_profile_url: string,
  user_picture_url?: string,
}
// NO timestamp field. NO provider_id field.
```

`**message_received` inbound detection:**

```ts
const isOutbound = data.sender.attendee_provider_id === data.account_info.user_id;
```

**Unipile fires webhooks twice** — all handlers must be idempotent. `isDuplicate()` checks `Message.externalId` before processing.

**Nicolas's test LinkedIn account:** `accountId: Zi8sHaTJQc-GrDZ_SwQnkQ`

---

## Apify scraper

- Actor: `harvestapi~linkedin-profile-search`
- Polling: 3s interval, 120s timeout
- `industries` and `companySizes` filters are **not passed to the actor** — actor expects LinkedIn numeric codes / headcount codes, not free-form strings
- Dataset items fetched from `/actor-runs/{runId}/dataset/items` (not under `/acts/`)
- `providerLinkedinId` mapped from `raw.id`

---

## Hero video / animation (frontend)

- 144 PNG frames @ 24fps → compiled to `/animation/output.webm`
- Paper plane color: `#8B7FD4` (light face), `#6B5FBF` (shadow/fold)
- Background: `#0d0854` (brand-bg), purple: `#5326b7`
- Hook: `useHeroVideo` — plays full animation once, then loops from frame 116 (4.79s) = bounce loop
- `<video>` is `poster="/BG.png"`, covers full hero section

---

## Frontend brand constants

```ts
BRAND_COLORS = { purple: '#5326b7', bg: '#0d0854', purpleLight: '#7a58c4', purpleDark: '#24106e' }
ANIMATION_VIDEO_SRC = '/animation/output.webm'
ANIMATION_TOTAL_FRAMES = 144
ANIMATION_BOUNCE_LOOP_START_INDEX = 115  // 0-indexed → frame 116
```

---

## Pricing model (Stripe-integrated — do not hardcode amounts in UI)

Superseded the earlier "modular à la carte" plan. Stripe is fully integrated
(`apps/api/src/routes/billing.ts`, `stripe-webhook.ts`,
`apps/api/src/lib/billing/pricing.ts`, mock mode via `STRIPE_MOCK_MODE`).
Pricing is now per campaign type, not per channel:

- One line item selected by `Strategy.campaignType`: `personalized_outreach`,
  `ai_video_ad`, or `uploaded_video` — each maps to its own Stripe Price ID via
  a `STRIPE_PRICE_*` env var.
- A `video_addon` line item is always added on top.
- Actual monetary amounts are Stripe's source of truth (configured in the
  Stripe dashboard), never hardcoded here or in the UI — see
  `buildPricingCatalog()` in `pricing.ts`.
- Entitlement (`Organization.subscriptionStatus`) is finalized by verified
  Stripe webhook events, never by a frontend callback.

---

## Do not do

- Do not use HMAC for Unipile webhook verification — it uses `Unipile-Auth` header, not `X-Unipile-Signature`
- Do not add `timestamp` or `provider_id` to `UnipileNewRelationSchema` — not in payload
- Do not commit `.env` files
- Do not use `any` in TypeScript without a comment explaining why
- Do not hardcode price amounts in the UI — Stripe is the source of truth (see Pricing model above)
- Do not use Claude's browsing for Discovery agent — always Firecrawl first
- Do not push directly to `main` — all work goes to `develop` (last commit: `22f47b0`)
- Do not call `campaignSequenceQueue.remove()` with a job that doesn't exist — it throws, catch it (already handled in `cancelPendingSequenceJobs`)
- Do not pass `industryIds` or `companyHeadcount` to Apify unless you confirm the actor's actual input schema — current filters intentionally omit these

---

## Competitors


| Tool                      | Focus                        | Gap vs LeadReacher         |
| ------------------------- | ---------------------------- | -------------------------- |
| Clay                      | Data enrichment + routing    | No outreach execution      |
| HeyReach                  | LinkedIn only                | No video, no multi-channel |
| Apollo.io                 | Email + LinkedIn             | No personalized video      |
| Lemlist                   | Email + LinkedIn             | No WhatsApp/Instagram      |
| Gojiberry AI (YC, $99/mo) | LinkedIn + 30 intent signals | No video, LinkedIn only    |


LeadReacher's differentiation: **multi-channel + AI personalized video in one platform**.