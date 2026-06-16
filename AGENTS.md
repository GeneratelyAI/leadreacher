# AGENTS.md — LeadReacher

Context file for Cursor and AI agents. Read this before touching any file in the repo.

---

## What this project is

LeadReacher is a multi-channel B2B outreach automation SaaS. It finds leads (via Apify LinkedIn scraper), enriches them (via Firecrawl), writes personalized connection notes and follow-up sequences (via Claude API), and sends them across LinkedIn, WhatsApp, Instagram, and email (via Unipile). Campaigns run on a BullMQ job queue: send invite → wait for acceptance → send follow-up message. Replies come back via Unipile webhooks.

**Co-founders:** Samo Ayoub (business), Nicolas Cantanhede (CTO, this repo).  
**Intern:** Kai (kaiyue.wei@outlook.com) — backend only.  
**Repo:** `nickcantanhede/leadreacher` (private, monorepo).

---

## Monorepo structure

```
/
├── apps/
│   ├── api/          # Fastify backend (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── handlers/
│   │   │   ├── workers/       # BullMQ workers
│   │   │   ├── adapters/      # UnipileAdapter, ApifyAdapter, FirecrawlAdapter
│   │   │   ├── scripts/       # One-off scripts (e.g. recreate-unipile-webhooks.ts)
│   │   │   └── lib/           # Shared utilities, AppError hierarchy
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── .env               # Never commit. See .env.example
│   └── web/          # Next.js frontend (TypeScript + Tailwind)
│       └── src/
│           ├── app/           # App Router
│           └── components/
└── packages/
    └── shared/       # Shared types between apps/api and apps/web
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | Fastify, TypeScript |
| Database | Supabase (Postgres) + Prisma ORM |
| Queue | BullMQ + Upstash Redis |
| Outreach channels | Unipile (LinkedIn, WhatsApp, Instagram, Facebook) |
| Email outreach | Smartlead |
| Lead scraping | Apify (LinkedIn scraper actor) |
| Lead enrichment | Firecrawl (company website → markdown) |
| AI (sequences + strategy) | Anthropic Claude API (`claude-sonnet-4-6`) |
| AI (video) | Google Veo via Google AI Studio |
| Video storage | Cloudflare R2 |
| Payments | Stripe |
| Frontend hosting | Vercel |
| Backend hosting | Railway |
| Tunnel (dev) | ngrok — stable domain `https://antler-concert-unluckily.ngrok-free.dev` |

---

## Environment variables (apps/api/.env)

```
UNIPILE_API_KEY=...
UNIPILE_DSN=api49.unipile.com:17966
UNIPILE_WEBHOOK_SECRET=67566c83615ee686c985dc172b82f1d51b8b26a460ffbbe9d2c2a25cc3701478
DATABASE_URL=...          # Supabase Postgres connection string
DIRECT_URL=...            # Supabase direct URL (for Prisma migrations)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
ANTHROPIC_API_KEY=...
APIFY_API_TOKEN=...
FIRECRAWL_API_KEY=...
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
GOOGLE_AI_STUDIO_API_KEY=...
NGROK_DOMAIN=antler-concert-unluckily.ngrok-free.dev
```

---

## Unipile integration

Unipile handles all social channel communication. Key facts:

- **Auth:** Custom `Unipile-Auth` header (NOT HMAC/Stripe-style signature). The header value equals `UNIPILE_WEBHOOK_SECRET` set at webhook creation time.
- **Webhooks:** Two webhooks registered via `apps/api/src/scripts/recreate-unipile-webhooks.ts`
  - `leadreacher-messaging` — `source: "messaging"`, `events: ["message_received"]`
  - `leadreacher-relations` — `source: "users"`, `events: ["new_relation"]`
- **Nicolas's test LinkedIn account:** `accountId: Zi8sHaTJQc-GrDZ_SwQnkQ`
- **Unipile fires webhooks twice** (retry behavior) — handlers must be idempotent.
- **`new_relation` payload shape** (actual Unipile schema — do not change):
  ```ts
  { user_provider_id, user_full_name, user_public_identifier, user_profile_url, user_picture_url }
  // No `timestamp` field. No `provider_id` field.
  ```
- **`message_received` direction detection:** use `sender.attendee_provider_id` to distinguish inbound vs outbound.

---

## Campaign flow (BullMQ)

```
POST /leads/scrape (Apify) → leads saved to DB
      ↓
Campaign worker picks up lead
      ↓
T1: Check if already connected (Unipile)
T2: Send connection invite (if not connected)
T3: Wait for `new_relation` webhook → lead accepted
T4: Enrich company via Firecrawl
T5: Claude generates personalized message
T6: Send message via Unipile startChat
      ↓
`message_received` webhook fires on reply
      ↓
Auto-cancel pending BullMQ jobs for that lead (Kai's task)
```

**Important:** If lead is already connected, skip T2/T3, go straight to T4.

---

## Prisma schema (key models)

- `User` — platform user (customer)
- `Organization` — customer's company
- `SocialAccount` — connected Unipile account (LinkedIn, WhatsApp, etc.)
- `Campaign` — outreach campaign config
- `CampaignLead` — join table: lead assigned to a campaign, tracks status
- `Lead` — scraped/imported prospect
- `Message` — sent/received message log

---

## Webhook endpoint

```
POST /webhooks/unipile
Header: Unipile-Auth: <UNIPILE_WEBHOOK_SECRET>
```

Verification logic: compare `req.headers['unipile-auth']` to `process.env.UNIPILE_WEBHOOK_SECRET`. Reject with 401 if mismatch.

---

## Apify scraper

- Actor: LinkedIn profile scraper
- Endpoint: `POST /leads/scrape`
- Params: `{ maxResults, filters: { jobTitle, industry, country } }`
- Returns: `{ imported, skipped, total }`
- Confirmed working. Returns ~16k+ matching profiles for CTO/SaaS/US filter.

---

## Pricing model (in flux — do not hardcode in UI yet)

Modular à la carte:
- **Base:** $200/mo — core platform, scraper, dashboard, queue, up to 500 leads/mo
- **Per channel:** +$49/mo each (LinkedIn, WhatsApp, Instagram, Facebook)
- **Video personalization:** +$100/mo
- Channel caps enforced in backend, not via Stripe metering
- Annual billing: 20% discount

Previous tiered model ($197/$397/$797) is **deprecated**.

---

## Discovery agent / onboarding

The onboarding flow uses an AI strategy agent:
1. User provides their website URL
2. Firecrawl scrapes the site → clean markdown
3. Claude reads the markdown → suggests target ICP, channels, and outreach angle
4. User confirms or adjusts before campaign goes live

This is the "Discovery" step. Do not use Claude's own browsing — always go through Firecrawl first.

---

## Active development branch

`develop` — all work goes here. Last commit: `22f47b0`.

Do not push directly to `main`.

---

## Kai's assigned tasks (backend intern)

1. Handle already-connected leads — skip invite, call `startChat` directly
2. Auto-cancel queued BullMQ jobs when a `message_received` webhook fires for that lead
3. `message_received` inbound/outbound direction detection

Do not assign Kai tasks touching: Stripe, pricing UI, checkout flow, or Discovery agent — those are still in flux.

---

## Key decisions (do not revisit without context)

- **Unipile over native LinkedIn API** — native API access pending; Unipile is the production path
- **Apify over manual scraping** — confirmed working, early-stop at `maxResults`, no custom actor needed
- **Firecrawl for enrichment** — fetches company website as clean markdown for Claude prompts; also used in Discovery onboarding
- **Google AI Studio for Veo** — using Fast tier ($0.15/sec); abstraction layer in place for future Vertex AI migration; store to R2 immediately (Veo deletes after 48h)
- **Checkout UX:** multi-step (channel selection → video upsell → payment), not single-page
- **Intent signals** (job changes, funding news, etc.) — currently Week 6–10 roadmap item but may be pulled earlier; Gojiberry AI (YC, $99/mo) is already marketing this

---

## Competitors

| Tool | Focus | Weakness vs LeadReacher |
|---|---|---|
| Clay | Data enrichment + routing | No outreach execution |
| HeyReach | LinkedIn only | No video, no multi-channel |
| Apollo.io | Email + LinkedIn | No personalized video |
| Lemlist | Email + LinkedIn | No WhatsApp/Instagram |
| Gojiberry AI | LinkedIn + intent signals | No video, LinkedIn only |

LeadReacher's differentiation: **multi-channel + AI personalized video in one platform**.

---

## Do not do

- Do not use HMAC signature verification for Unipile webhooks (wrong scheme)
- Do not use `provider_id` or `timestamp` in `new_relation` handler (not in Unipile's payload)
- Do not commit `.env` files
- Do not use `any` types in TypeScript without a comment explaining why
- Do not start Stripe integration until pricing model is finalized with Samo
- Do not use Claude's browsing for Discovery agent — always Firecrawl first
