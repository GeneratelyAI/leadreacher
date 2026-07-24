# AGENTS.md — LeadReacher

Context file for Cursor and AI agents. Read this before touching any file in the repo.

---

## What this project is

LeadReacher is a multi-channel B2B outreach automation SaaS. It finds leads (via Apify LinkedIn scraper), writes personalized connection notes and follow-up sequences (via Claude API), and sends them across LinkedIn, WhatsApp, Instagram, and email (via Unipile). Campaigns run on a BullMQ job queue: send invite → wait for acceptance → send follow-up message. Replies come back via Unipile webhooks.

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
│   │   │   ├── adapters/
│   │   │   │   ├── apify.ts          # ApifyAdapter — LinkedIn scraper
│   │   │   │   ├── unipile.ts        # UnipileAdapter — all social channel I/O
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
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts           # POST /auth/signup, /auth/login
│   │   │   │   ├── campaigns.ts      # CRUD + /launch + /leads enrollment
│   │   │   │   ├── health.ts         # GET /health
│   │   │   │   ├── leads.ts          # /leads/scrape, /leads/import/csv, CRUD
│   │   │   │   ├── social-accounts.ts
│   │   │   │   └── webhooks.ts       # POST /webhooks/unipile
│   │   │   ├── scripts/
│   │   │   │   ├── get-test-token.ts
│   │   │   │   ├── recreate-unipile-webhooks.ts  # Run to reset webhooks
│   │   │   │   └── test-unipile.ts
│   │   │   ├── services/
│   │   │   │   ├── campaign-step1-chat.ts  # deliverSequenceStep1ViaChat()
│   │   │   │   └── lead-import.ts          # importFromCSV(), importScrapedProfiles()
│   │   │   ├── types/
│   │   │   │   └── fastify.d.ts      # Adds orgId to FastifyRequest
│   │   │   ├── workers/
│   │   │   │   └── campaign-sequence.ts  # BullMQ worker — runs campaign steps
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
| Outreach channels         | Unipile (LinkedIn, WhatsApp, Instagram, Facebook)                      |
| Email outreach            | Smartlead                                                              |
| Lead scraping             | Apify actor `harvestapi~linkedin-profile-search`                       |
| Lead enrichment           | Firecrawl (planned — company website → markdown for Claude)            |
| AI (sequences + strategy) | Anthropic Claude API (`claude-sonnet-4-6`)                             |
| AI video                  | Google Veo via Google AI Studio                                        |
| Video storage             | Cloudflare R2                                                          |
| Payments                  | Stripe (not yet integrated)                                            |
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

## Pricing model (in flux — do not hardcode in UI)

Modular à la carte:

- **Base:** $200/mo — platform, scraper, dashboard, queue, up to 500 leads/mo
- **Per channel:** +$49/mo each (LinkedIn, WhatsApp, Instagram, Facebook)
- **Video personalization:** +$100/mo (Veo, stored to R2)
- **Annual toggle:** 20% discount across all
- No Stripe integration started yet — waiting on pricing finalization with Samo

---

## Do not do

- Do not use HMAC for Unipile webhook verification — it uses `Unipile-Auth` header, not `X-Unipile-Signature`
- Do not add `timestamp` or `provider_id` to `UnipileNewRelationSchema` — not in payload
- Do not commit `.env` files
- Do not use `any` in TypeScript without a comment explaining why
- Do not start Stripe integration until pricing is finalized
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