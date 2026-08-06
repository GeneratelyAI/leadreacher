# Dashboard

`/dashboard` is the permanent workspace for completed organizations. It is
protected by authentication and redirects incomplete organizations back to
their computed onboarding resume step.

## Sections

1. [Overview](overview.md)
2. [Campaigns](campaigns.md)
3. [Prospects](prospects.md)
4. [Messages](messages.md)
5. [Channels](channels.md)
6. [Analytics](analytics.md)
7. [Settings](settings.md)
8. [Everything: navigation, states, and architecture](everything.md)
9. [Implementation map for AI agents](implementation-map.md)

## Current status

All seven listed sections, plus an unlisted `/dashboard/activity` view (same
data as Overview's live activity, unfiltered by campaign — see
implementation-map.md), are available through real nested
`/dashboard/<section>` routes and use organization-scoped API data. Current
scope is intentionally focused:

- Completing onboarding explicitly launches the first LinkedIn campaign using
  approved prospects and copy derived from the saved strategy. Campaigns created
  later in the dashboard still require prospect enrollment and an explicit
  launch confirmation. A running campaign can be paused and resumed.
- Prospects updates lifecycle status, enrolls selected records in a campaign,
  and supports client-side search and lifecycle/source/campaign filters.
- Messages is an operator inbox: an AI-drafted reply can be edited and sent,
  LinkedIn-only today, gated on an inbound message and the daily send limit.
- Channels lists, syncs, and starts hosted authorization for LinkedIn,
  WhatsApp, Instagram, Gmail, and Outlook accounts.
- Analytics exposes factual aggregate delivery and lifecycle counts.
- Settings updates the organization name and opens Stripe Billing Portal where
  available.

Advanced campaign sequence editing, team controls, and period-over-period
trend reporting beyond Overview's own week-over-week deltas remain future work
rather than implied capabilities.

## Product rule

The dashboard must use persisted, organization-scoped data. It must not invent
forecast percentages, sentiment, video views, trend deltas, or recommendations
that the product cannot substantiate.

## Implementation entry point

Before changing the workspace, read the
[AI implementation guide](../IMPLEMENTATION_GUIDE.md) and the
[dashboard implementation map](implementation-map.md). They define the current
Overview contract, layout behavior, operational tab boundary, and required
tests.
