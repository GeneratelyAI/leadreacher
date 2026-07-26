# Onboarding System Design

## Routing model

Onboarding is one protected route, `/onboarding`, driven by query parameters:

- `step=discovery|strategy|campaign-type|video-decision|checkout|channels`
- `substep=how-it-works|targeting|channels` when `step=strategy`

The server validates requested values, computes a safe fallback from persisted
state, and redirects to the canonical URL. This makes refresh and browser
back/forward navigation durable without introducing a second client-side state
store.

## Authentication and organization bootstrap

The route requires a Supabase user. Bootstrap resolves or creates the
organization and supplies its organization ID to the API. A completed
organization is redirected to `/dashboard`; an incomplete one can resume setup.

## State ownership

| Concern | Source of truth |
| --- | --- |
| Website URL before signup | Browser storage plus anonymous scrape context |
| Scrape progress and outcome | API-backed scrape status, scoped by anonymous ID or organization |
| Discovery and Strategy output | Postgres Strategy records |
| Campaign type and video decision | Postgres Strategy fields |
| Subscription entitlement | Verified Stripe webhook state on Organization |
| Channel account state | Postgres SocialAccount records backed by Unipile |
| Setup completion | `Organization.onboardedAt` |

## External-service boundaries

- Firecrawl and Groq failures are returned as explicit scrape or generation
  states. The UI must not fill missing insights with guesses.
- Stripe redirect success is not billing success. Subscription webhooks are the
  entitlement authority.
- Unipile hosted auth connects an account but does not launch outreach.
- Paid video work uses durable template and asset states so ambiguous provider
  errors do not silently cause duplicate work.

## Security and isolation

- Protected API requests use the authenticated organization as the ownership
  boundary.
- Anonymous scrape handoff is claimed at authentication and source-scoped to
  avoid cross-account or cross-URL result leakage.
- Provider secrets live in deployment environments, never in browser state or
  repository documentation.
