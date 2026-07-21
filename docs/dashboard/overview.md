# Overview

## Function

Overview answers whether the acquisition engine is ready or running, what has
happened, and what needs a user decision. It is the default `/home` view.

## Current implementation

`GET /dashboard/overview` returns organization-scoped data for:

- engine status
- prospect, active outreach, reply, meeting, and sent-outreach counts
- latest active campaign, or latest draft/review campaign
- connected channel health
- billing, channel, campaign, and video attention items
- recent activity from persisted messages, leads, video assets, and campaigns

## Engine precedence

1. Subscription is not active: billing needs attention.
2. No healthy channel: connect a channel.
3. No active campaign: ready to launch.
4. Otherwise: acquisition engine running.

## UI and state design

- The app shell keeps sidebar and top bar fixed; the workspace canvas is the
  scrollable region on constrained viewports.
- Empty data is intentional: no campaign presents a truthful ready-to-launch
  state rather than invented campaign performance.
- Cards use the shared dashboard and onboarding tokens in both light and dark
  themes. Social channels use their actual brand marks.

## Next work

The current no-campaign state should evolve into a real creation and review
workflow, not an automatic campaign launch.
