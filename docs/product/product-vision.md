# LeadReacher Product Vision and Workflow

LeadReacher is an AI-assisted B2B outreach platform. It helps an organization
turn its website and business context into a strategy, a campaign setup, and an
operational workspace for managing outreach.

## Core journey

```text
Landing page
  -> website URL
  -> signup or login
  -> first-time onboarding
  -> completed organization
  -> dashboard workspace
  -> explicit campaign creation, prospect approval, and launch
```

The full setup sequence is documented in [Onboarding](../onboarding/README.md).
After completion, `Organization.onboardedAt` is the durable boundary between
first-time setup and daily product use:

- Completed users go to `/home` after login.
- Visiting `/onboarding` after completion redirects to `/home`.
- Incomplete organizations resume onboarding at the server-calculated safe step.

## What onboarding establishes

| Stage | Durable output |
| --- | --- |
| Discovery | Website-derived context plus the user's competitive advantage |
| Strategy | Audience, positioning, messaging angles, and recommended channels |
| Campaign type | Delivery model: personalized outreach, AI video ad, or uploaded video |
| Video decision | Message/tone or uploaded-media configuration needed for billing and generation |
| Checkout | Verified Stripe subscription entitlement |
| Channels | At least one connected channel account for future delivery |

## What the dashboard is for

The dashboard is the organization's permanent operating workspace. It must help
users understand what is ready, what is running, and what needs a decision.

The first dashboard release is [Overview](../dashboard/overview.md). It uses
real, organization-scoped counts and activity rather than invented forecasts or
performance claims. The wider information architecture is documented in
[Dashboard](../dashboard/README.md).

## Campaign launch model

Completing onboarding does not send outreach. This is deliberate:

1. Create a campaign from the completed Strategy.
2. Add and approve prospects.
3. Review channels, sequence, and first outreach content.
4. Confirm launch explicitly.
5. Queue the outreach sequence and monitor it from the dashboard.

This separates configuration from external side effects. A channel connection or
Stripe checkout alone never sends a message.

## Product principles

- Use observed or persisted data. Do not fabricate scrape outputs, trends,
  forecasts, reachability, or recommendations.
- Keep the human in control of campaign launch and customer-facing delivery.
- Treat external providers as unreliable boundaries: persist progress, recover
  safely, and surface explicit failure states.
- Keep the operational product focused on outreach work, not marketing copy.

## Current boundaries

- Overview is operational; the other dashboard areas are planned and visibly
  unavailable until their data contracts and actions are implemented.
- LinkedIn is the active onboarding channel connection. Other listed channel
  options remain future work until their delivery and account-management paths
  are live.
- Video configuration is mandatory, but live paid generation should only be
  enabled when its provider credentials and operational checks are ready.
