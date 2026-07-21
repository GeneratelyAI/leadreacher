# System Architecture

## Product layers

| Layer | Responsibility |
| --- | --- |
| `apps/web` | Next.js application for landing, authentication, onboarding, and dashboard workflows |
| `apps/api` | Fastify API for auth-scoped business logic, billing, strategy, campaigns, and integrations |
| Postgres via Prisma | Organization-scoped durable product state |
| Redis and BullMQ | Background campaign, recovery, and media-processing work |
| Provider adapters | Firecrawl, Groq, Apify, Unipile, Stripe, Google AI/TTS, and Cloudflare R2 integration boundaries |

## Organization boundary

Every protected request resolves an authenticated organization ID. Dashboard,
Strategy, campaigns, leads, messages, social accounts, assets, and audit records
are queried and mutated within that boundary.

## Lifecycle

```text
Website URL -> Discovery -> Strategy -> campaign and video decisions
-> verified billing -> channel connection -> completed organization
-> dashboard -> explicit campaign creation and launch -> background delivery
```

## Delivery and recovery principles

- External side effects are protected by durable delivery attempts and provider
  reconciliation where available.
- Provider webhooks are assumed to be duplicated and out of order.
- Paid video generation is persisted and recovered rather than resubmitted after
  ambiguous failures.
- A failed or unavailable dependency must produce an explicit state, never
  invented campaign, analytics, or scrape data.

## Observability

Sentry captures application errors. Better Stack receives structured operational
events. Health and readiness endpoints support deployment checks. See the
operational and video documentation for concrete procedures.
