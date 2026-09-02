# Onboarding billing setup

This guide configures the production backend for the onboarding path from video
decision through checkout and channel connection. Local development and tests
use Stripe mock mode by default and never call Stripe.

## Environment

Set these values in `apps/api/.env` or the deployed API environment. Do not put
any of them in frontend variables.

| Variable | Required when | Value |
| --- | --- | --- |
| `STRIPE_MOCK_MODE` | Always | `true` for local/test; `false` in production. The API refuses to start with it enabled in production. |
| `STRIPE_SECRET_KEY` | `STRIPE_MOCK_MODE=false` | Stripe secret API key (`sk_...`). |
| `STRIPE_WEBHOOK_SECRET` | `STRIPE_MOCK_MODE=false` | Signing secret for the `/webhooks/stripe` endpoint (`whsec_...`). |
| `STRIPE_PRICE_PERSONALIZED_OUTREACH` | Live personalized outreach checkout | Recurring Stripe Price ID for Personalized outreach. |
| `STRIPE_PRICE_AI_VIDEO_AD` | Live AI video ad checkout | Recurring Stripe Price ID for AI video ad. |
| `STRIPE_PRICE_UPLOADED_VIDEO` | Live uploaded video checkout | Recurring Stripe Price ID for Uploaded video outreach. |
| `STRIPE_PRICE_VIDEO_ADDON` | Personalized video is selected | Recurring Stripe Price ID for the $30 monthly personalized video add-on. |
| `STRIPE_PRICE_ADDITIONAL_CHANNEL` | More than one outreach channel is selected | Recurring Stripe Price ID for each $50 monthly additional channel. |
| `APP_URL` | Always | Browser origin used for Stripe and Hosted Auth success/failure redirects, for example `https://app.leadreacher.ai`. |
| `UNIPILE_WEBHOOK_URL` | Hosted Auth connection | Public API URL ending in `/webhooks/unipile`; takes precedence over `PUBLIC_BASE_URL`. |
| `PUBLIC_BASE_URL` | Hosted Auth connection if no explicit URL | Public API base URL. The adapter appends `/webhooks/unipile`. |

`UNIPILE_API_KEY` and `UNIPILE_WEBHOOK_SECRET` remain required for Unipile v2
Hosted Auth and signed webhook delivery. Use one v2 Service API key for backend
operations and webhook administration. Never expose either secret to frontend
code.

## Stripe dashboard

1. Create a Product and recurring Price for each campaign type:
   - Personalized outreach → `STRIPE_PRICE_PERSONALIZED_OUTREACH`
   - AI video ad → `STRIPE_PRICE_AI_VIDEO_AD`
   - Uploaded video outreach → `STRIPE_PRICE_UPLOADED_VIDEO`
2. Create the recurring $30 Personalized video add-on Price and copy its ID to
   `STRIPE_PRICE_VIDEO_ADDON`.
3. Create the recurring $50 Additional channel Price and copy its ID to
   `STRIPE_PRICE_ADDITIONAL_CHANNEL`. The first selected channel is included in
   the campaign price.
4. Add a Stripe webhook endpoint at
   `https://<public-api-host>/webhooks/stripe`.
5. Subscribe it to `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`, and
   `customer.subscription.deleted`.
6. Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.
7. Set `STRIPE_MOCK_MODE=false` and deploy the API. A Checkout redirect is not
   an entitlement: the verified webhook is the only path that activates a plan.

## Local and test mode

Leave `STRIPE_MOCK_MODE=true` with all Stripe keys and Price IDs empty. Billing
returns catalog placeholders and a deterministic local success URL. Tests can
submit a signed mock Stripe event using `createMockStripeWebhookEvent()` from
`src/lib/stripe.ts`; no Stripe API key is needed.

## Validation command

After populating the Stripe values, point `DIRECT_URL` at an intended
local/development database and run all onboarding gates in one command. Never
use a production database URL here:

```bash
DIRECT_URL='postgresql://<local-user>@localhost:5432/<local-db>' pnpm --filter @leadreacher/api exec prisma migrate deploy && pnpm --filter @leadreacher/api build && pnpm --filter @leadreacher/api lint && pnpm --filter @leadreacher/api test
```

This applies migrations to the local database, regenerates Prisma, type-checks,
and runs the mocked end-to-end onboarding test with the rest of the suite.
