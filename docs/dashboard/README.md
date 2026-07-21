# Dashboard

`/home` is the permanent workspace for completed organizations. It is protected
by authentication and redirects incomplete organizations back to their computed
onboarding resume step.

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

All seven sections are available through `/home?view=<section>` and use
organization-scoped API data. Current scope is intentionally focused:

- Campaigns creates reviewed LinkedIn drafts and explicitly launches them.
- Prospects updates lifecycle status and enrolls selected records in a campaign.
- Messages is a read-only timeline of persisted inbound and outbound records.
- Channels lists, syncs, and starts hosted authorization for accounts.
- Analytics exposes factual aggregate delivery and lifecycle counts.
- Settings updates the organization name and opens Stripe Billing Portal where
  available.

Threaded reply composition, advanced campaign editing, filters, team controls,
and trend reporting remain future work rather than implied capabilities.

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
