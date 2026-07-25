# Overview

## Function

Overview answers what needs a decision right now, whether outreach is
healthy, and what happened recently. It is the default `/dashboard` view,
framed as an operator's daily triage screen ("Today") rather than a static
performance summary.

## Current implementation

`GET /dashboard/overview` returns organization-scoped data for:

- engine status (`resolveDashboardEngine()`)
- prospect, active outreach, reply, meeting, sent-outreach, and converted
  (customer) counts, each for the requested date range
- week-over-week **trends** for those metrics (`direction: up | down | flat |
  new`, `percent`), computed by comparing the requested range against the
  immediately preceding range of equal length, not a forecast or an invented
  baseline
- a daily-bucketed **activity trend** (sent vs. replies) for the requested
  range, real `GROUP BY`-style aggregation over persisted `Message` rows
- `unreadNotificationCount`, real count of inbound messages missing `readAt`
  or `handledAt`
- **`actions`**: real operator triage data, inbound messages needing a reply
  (`needsReply`/`needsReplyCount`), social accounts needing reconnect
  (`reconnectAccounts`), failed or unknown-state sends from the last 48
  hours (`failedSends`/`failedSendCount`), and prospects contacted but not
  yet connected (`stalled`/`stalledCount`)
- **`sendingHealth`**: real per-sender daily rate-limit state (`invite`/
  `message` remaining vs. limit, from the same daily-cap rate limiter that
  enforces sends), unhealthy accounts, and pending invite acceptances
- latest active campaign, or latest draft/review campaign, including
  per-campaign `stats` (prospects, contacted, replies, meetings, customers),
  real per-channel `channelSendCounts`, and video status
- connected channel health
- billing, channel, campaign, and video attention items
- recent activity from persisted messages, leads, video assets, and campaigns,
  filterable by `activityKind` and the same date range

## Engine precedence

1. Subscription is not active: billing needs attention.
2. No healthy channel: connect a channel.
3. No active campaign: ready to launch.
4. Otherwise: acquisition engine running.

## UI and state design

Owner: `apps/web/src/components/dashboard/DashboardOverviewClient.tsx`,
rendered from `apps/web/src/app/dashboard/page.tsx`. Verified against the
live-rendered page, not just source, on 2026-07-24.

Page order, top to bottom in the main column:

1. **Header** ("Today" + engine status pill), a real week-over-week trend
   badge next to "New campaign" ("vs prior period", not "vs forecast").
2. **`TodayActionsPanel`**: an operator triage list built entirely from
   `overview.actions`, "N need a reply", "N channels need reconnect", "N
   failed or unknown sends", "N waiting on invite acceptance", each a real
   count with a link to where it's resolved. Renders "You're clear for now"
   when every count is zero, not an empty placeholder.
3. **`SendingHealthStrip`**: messages left / invites left today (from the
   real daily rate limiter), prospects awaiting invite acceptance, and a
   health-flags count linking to reconnect or failed-send review. This is
   the first place in the UI that surfaces the per-sender daily send caps
   enforced server-side.
4. **Four metric cards** with real week-over-week deltas. A metric with no
   prior-period data renders "New activity this period" rather than a
   misleading percentage.
5. **Primary campaign card**: status, video (real `VideoAsset` or an honest
   "not used yet" state, never a stock placeholder), real per-channel send
   counts under "Channels Active" (not a fabricated deliverability
   percentage), a 5-cell stat row, and a monotonic funnel stepper (Setup →
   Prospects Added → Outreach Running → Meetings Booked), a later stage
   cannot render complete while an earlier stage is still pending.
6. **Live activity**, filterable by kind, real avatars and timestamps.
7. **Recommendations**: `buildRecommendationItems()` prefers the real
   insights engine (`GET /dashboard/analytics/insights`, tagged "AI") when
   it has ready output, shows a "Generating" spinner while insights are
   still aggregating, and otherwise falls back to the same real operator
   actions as the triage panel (tagged "Ops"), never a fabricated
   suggestion.
8. **`OverviewInsightCarousel`**: a 4-slide auto-rotating (3s, pauses on
   hover/focus) carousel, all four slides are real data, no fabrication:
   - *Today's insight*: the featured insight text plus the real daily
     sent/replies area chart (`Chart`/`AreaChart` from
     `components/ui/chart.tsx`). No "vs your average" claim, that needs a
     defined baseline methodology that doesn't exist yet.
   - *Connect more channels*: an honest count of how many of
     LinkedIn/WhatsApp/Instagram/Gmail are actually connected
     (`"{connectedCount} of {total} channels live"`), only lists channels
     that are genuinely missing, "Gmail" here maps to a real `email`/
     `google` platform check, not a fabricated integration.
   - *Action queue*: the same needs-reply/stalled/failed counts as the
     triage panel, in a compact card form.
   - *Sending health*: the same rate-limit data as the strip, with a visual
     progress bar per limit.

Empty data throughout is intentional: no campaign presents a truthful
ready-to-launch state rather than invented campaign performance. Cards use
the shared dashboard and onboarding tokens in both light and dark themes.
Social channels use their actual brand marks (`ChannelLogo`).

## Shadcn adoption status

Overview uses real shadcn primitives already installed in `components/ui/`:
`Chart` (Recharts wrapper, used twice, the carousel's insight slide and
previously the standalone card), `Select` for the activity filter,
`Carousel`/`CarouselContent`/`CarouselItem` for the insight carousel,
`Tooltip` for the channel-connect stickers. It does **not** yet use
`Sidebar`/`Command`/`Popover`+`Calendar`/`Collapsible`, the top bar (search,
date range picker, notification bell, user menu) and the sidebar's
collapsible "Connected Channels" block are still the pre-shadcn
implementation. See `implementation-map.md` for what's left.

## Known data anomaly (not a code defect)

On at least one test account, `Organization.plan` holds the literal string
`"uploaded_video"` instead of a real plan tier. The UI renders this field
correctly wherever it appears (verified in `DashboardShell.tsx`), no code
writes `Organization.plan` directly in the routes/services searched, so this
looks like stale manual test data from earlier campaign-type/video-decision
testing, not a bug to fix in this pass. Worth cleaning up the affected
row(s) before demoing.

## Next work

- Wire the top bar to real search (`GET /dashboard/prospects`,
  `GET /campaigns`), a functional `Popover`+`Calendar` date range picker
  (the API already accepts `startDate`/`endDate` and computes `trends`
  against it, only the picker UI is missing), and the real
  `unreadNotificationCount` already returned by the API but not yet
  surfaced in a bell icon.
- Rebuild the sidebar's channel status block as a `Collapsible` + `Card`
  reading real `SocialAccount` rows.
