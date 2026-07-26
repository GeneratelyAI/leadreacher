# Dashboard Implementation Map

Use this document to implement LeadReacher after onboarding. The dashboard is
an operations workspace, not a marketing landing page. It must render only
real, organization-scoped operating data and make unavailable areas explicit.

## Current product boundary

`/dashboard` is the permanent destination for a completed organization, with
real nested routes per section (no more `?view=` query-param switching). The
dashboard creates drafts and launches campaigns only after an explicit user
action. The operating workflow is:

```text
completed onboarding
  -> automatically create one reviewed campaign draft from Strategy
  -> open the draft in Campaigns
  -> add and approve prospects
  -> edit and save the connection note
  -> review first outreach and channels
  -> user confirms launch in the launch dialog
  -> existing sequence worker delivers outreach
```

## Runtime entry points

| Responsibility | Current file | Notes |
| --- | --- | --- |
| Authenticated `/dashboard` server entry | `apps/web/src/app/dashboard/layout.tsx` | Redirects unauthenticated users to `/login`; redirects incomplete orgs to `/onboarding`; renders the persistent shell for completed orgs. |
| App shell | `apps/web/src/components/dashboard/DashboardShell.tsx` | Owns sidebar, top bar, and responsive layout shared by every `/dashboard/*` route. |
| Overview UI | `apps/web/src/components/dashboard/DashboardOverviewClient.tsx` | Rendered from `apps/web/src/app/dashboard/page.tsx`. See `overview.md`. |
| Other workspace views | `apps/web/src/components/dashboard/DashboardWorkspaceViews.tsx` | Owns Campaigns, Messages, Channels, Analytics, and Settings, each rendered from its own `apps/web/src/app/dashboard/<section>/page.tsx`. |
| Prospects | `apps/web/src/app/dashboard/prospects/page.tsx`, `prospects/[id]/page.tsx`, `@modal/(.)prospects/[id]/page.tsx`, `ProspectDetailPanel.tsx` | Real routes with an intercepting route for the desktop detail drawer. |
| Dashboard API | `apps/api/src/routes/dashboard.ts` | Owns organization-scoped aggregation and activity normalization. |
| Protected route registration | `apps/api/src/plugins/protected-routes.ts` | Registers `dashboardRoutes` after JWT and organization middleware. |
| API tests | `apps/api/src/routes/__tests__/dashboard.test.ts` | Covers aggregate data, activity order, and engine precedence. |

## Route and navigation contract

| Navigation item | Status | Current behavior |
| --- | --- | --- |
| Overview | Operational | `/dashboard` uses `GET /dashboard/overview`. |
| Campaigns | Operational | `/dashboard/campaigns` uses existing `/campaigns` draft and launch endpoints. |
| Prospects | Operational | `/dashboard/prospects` (+ `/dashboard/prospects/[id]`) uses existing `/leads` and campaign enrollment endpoints, with review/approve/exclude states. |
| Messages | Operational | `/dashboard/messages` (+ `/dashboard/messages/[campaignLeadId]`) uses `GET /dashboard/messages`. Reply is a real, idempotency-protected send, not read-only. |
| Channels | Operational | `/dashboard/channels` uses social-account list, sync, and hosted-auth endpoints. |
| Analytics | Operational | `/dashboard/analytics` uses `GET /dashboard/analytics`. |
| Activity | Operational | `/dashboard/activity` uses the same activity data as Overview, unfiltered by campaign. |
| Settings | Operational | `/dashboard/settings` uses `GET/PATCH /dashboard/settings`. |

Each route includes loading, empty, and error states. Do not add a new route
merely because a navigation item is visible.

## Operational API contracts

The workspace client must use these existing, protected endpoints. Every call
is organization scoped by the API from the authenticated request. Never pass an
organization ID from the browser as a substitute for that scope.

| View | Read contract | Mutations | Important boundary |
| --- | --- | --- | --- |
| Campaigns | `GET /campaigns`, `GET /social-accounts` | `POST /campaigns`, `POST /campaigns/:id/launch` | Creating a draft sends nothing. Launch is explicit and existing API validation requires enrolled leads. |
| Prospects | `GET /leads?limit=100`, `GET /campaigns` | `PATCH /leads/:id`, `POST /campaigns/:id/leads` | Do not fabricate approval data. A selected record is only enrolled after the user chooses a campaign. |
| Messages | `GET /dashboard/messages` | None in this release | Read-only persisted delivery and inbound-reply timeline. Do not add a reply control without a channel-specific delivery design. |
| Channels | `GET /social-accounts` | `POST /social-accounts/sync`, `POST /social-accounts/connect` | Hosted authorization can return to `/dashboard/channels`; it authorizes/syncs an account and does not send messages. |
| Analytics | `GET /dashboard/analytics` | None | Show factual totals only. No forecasts, response rates, or trend deltas unless a persisted source is added. |
| Settings | `GET/PATCH /dashboard/settings` | `POST /billing/portal-session` | The first-release editable setting is the organization name. Open Billing Portal only when the API says it is available. |

## `GET /dashboard/overview` contract

Endpoint: `GET /dashboard/overview`

Authentication: required. The API obtains `orgId` from `request.orgId`; every
query must remain scoped to that organization.

Query params: `startDate`, `endDate` (defaults to the last 7 days vs. the
preceding 7 days), `activityKind` (filters the `activity` list).

Response shape (current):

```ts
type DashboardOverview = {
  organization: {
    name: string;
    plan: string;
    subscriptionStatus: string | null;
    hasBillingPortal: boolean;
  };
  engine: {
    status: "running" | "ready" | "needs_attention";
    label: string;
    detail: string;
  };
  metrics: {
    prospects: number;
    outreachInProgress: number;
    replies: number;
    meetingsBooked: number;
    outreachSent: number;
    customers: number;
  };
  trends: Partial<Record<keyof DashboardOverview["metrics"], {
    direction: "up" | "down" | "flat" | "new";
    percent: number | null;
  }>>;
  activityTrend: Array<{ date: string; sent: number; replies: number }>;
  dateRange: { startDate: string; endDate: string };
  unreadNotificationCount: number;
  primaryCampaign: {
    id: string;
    name: string;
    status: string;
    channels: string[];
    prospectCount: number;
    createdAt: string;
    updatedAt: string;
    startedAt: string;
    stats?: { prospects: number; contacted: number; replies: number; meetings: number; customers: number };
    channelSendCounts?: Record<string, number>;
    video?: CampaignVideoSummary | null;
  } | null;
  channels: Array<{
    id: string;
    platform: string;
    accountName: string;
    avatarUrl: string | null;
    status: string;
  }>;
  attention: Array<{
    kind: "billing" | "channels" | "campaign" | "video";
    title: string;
    detail: string;
  }>;
  activity: Array<{
    id: string;
    kind: "message" | "prospect" | "video" | "campaign";
    title: string;
    detail: string;
    occurredAt: string;
    avatarUrl?: string | null;
    channel?: string;
    action?: "reply" | "view";
    href?: string;
  }>;
  actions: {
    needsReply: Array<{ campaignLeadId: string; prospectName: string; company: string | null; avatarUrl: string | null; campaignName: string; preview: string; occurredAt: string }>;
    needsReplyCount: number;
    reconnectAccounts: Array<{ id: string; platform: string; accountName: string; status: string }>;
    failedSends: Array<{ id: string; kind: "automation" | "operator"; state: string; campaignLeadId: string; campaignName: string; prospectName: string; occurredAt: string }>;
    failedSendCount: number;
    stalled: Array<{ campaignLeadId: string; campaignId: string; campaignName: string; prospectName: string; company: string | null; currentStep: number; waitingSince: string }>;
    stalledCount: number;
  };
  sendingHealth: {
    senders: Array<{ id: string; accountName: string; status: string; invite: { limit: number; remaining: number; resetAt: string }; message: { limit: number; remaining: number; resetAt: string } }>;
    unhealthyAccounts: Array<{ id: string; platform: string; accountName: string; status: string }>;
    failedSendCount: number;
    pendingInviteAcceptances: number;
  };
};
```

`actions` and `sendingHealth` are new since the last verification pass, they
drive the `TodayActionsPanel` triage list and `SendingHealthStrip` on
Overview, plus two of the four `OverviewInsightCarousel` slides. See
`overview.md` for how each is used.

### Data rules

| UI value | Persisted source | Do not substitute with |
| --- | --- | --- |
| Prospects | `Lead` count for the organization, scoped to the date range | scraped estimate or sample data |
| Outreach in progress | active `CampaignLead` count for organization campaigns, scoped to the date range | campaign capacity |
| Replies | inbound `Message` count, scoped to the date range | sentiment estimate |
| Meetings booked | `Lead.status = meeting`, scoped to the date range | calendar guess |
| Sent outreach | outbound `Message` count, scoped to the date range | queued jobs |
| Customers | `Lead.status = converted`, scoped to the date range | any other conversion proxy |
| Trends | current-range count vs. the immediately preceding range of equal length | a forecast, a target, or "vs your average" without a defined baseline |
| Activity trend | outbound/inbound `Message` rows grouped by day for the date range | interpolated or invented daily points |
| Channel send counts | outbound `Message` count per channel for the primary campaign | a fabricated deliverability percentage |
| Primary campaign | active campaign, else most recently updated draft/review campaign | automatically-created campaign |
| Channel health | persisted `SocialAccount.status` | a logo alone or provider availability |
| Activity | persisted messages, leads, video assets, campaigns, sorted newest first, filterable by kind | invented views, opens, or trend events |
| Needs-reply / stalled / failed-send counts | inbound `Message` rows without a handled reply, `CampaignLead` rows contacted but not connected, `Message`/`ManualDeliveryAttempt` rows in a failed or unknown state | an estimated backlog or a fixed placeholder count |
| Sending health (messages/invites left) | the same daily rate-limit counters (`checkAndIncrementDailySendLimit`) that gate actual sends | a display-only limit that isn't the one actually enforced |

### Engine status precedence

Call `resolveDashboardEngine()` rather than duplicating this logic in a client:

1. Subscription is not `active`: `needs_attention`, billing.
2. No active channel: `needs_attention`, connect a channel.
3. No active campaign: `ready`, ready to launch.
4. Otherwise: `running`.

The order is intentional. A running campaign must not hide a broken billing or
channel prerequisite.

## UI composition and layout rules

`DashboardShell.tsx` has these stable regions, shared by every `/dashboard/*`
route:

1. Fixed desktop sidebar and compact mobile navigation.
2. Fixed top bar. Search, date range picker, and notification bell are still
   placeholder UI, the API already returns real search-able data and a real
   `unreadNotificationCount`, only the top bar wiring is outstanding, see
   `overview.md` → "Next work".
3. Theme control.

`DashboardOverviewClient.tsx` (Overview only) additionally has:

4. Header ("Today" + engine status) with a real week-over-week trend badge
   and "New campaign".
5. `TodayActionsPanel`, real operator triage (needs-reply / reconnect /
   failed-send / stalled counts, each linking to where it's resolved).
6. `SendingHealthStrip`, real daily send-limit remaining, sourced from the
   same rate limiter that enforces sends.
7. Four metric cells with real trend deltas.
8. Primary campaign card: status, video, real per-channel send counts, a
   5-cell stat row, and a monotonic funnel stepper.
9. Live activity, filterable by kind.
10. Recommendations, real insights engine when ready (tagged "AI"), real
    operator actions otherwise (tagged "Ops"), never fabricated.
11. `OverviewInsightCarousel`, 4 real-data slides (insight chart, channel
    connect status, action queue, sending health).

### Responsive scroll behavior

- The desktop application shell fills the viewport. Sidebar and header remain
  stable.
- At desktop width, the dashboard canvas should not force the whole browser
  page to scroll for a normal Overview. The recent-activity list takes the
  remaining vertical space and scrolls internally when needed.
- At narrow widths, normal page scrolling is correct. Do not force a tiny
  independently scrolling region on mobile.
- If an error state or unusually long content cannot fit, preserve access to
  all content rather than clipping it for visual symmetry.

### Visual rules

- Light-mode dashboard background is white. Dark mode uses existing dashboard
  and onboarding neutral tokens, never a separate palette.
- Use the existing `Button`, card styles, theme hook, and dashboard/onboarding
  token classes. Do not write one-off raw color systems for a new tab.
- Use Lucide icons for product actions and the actual `ChannelLogo` marks for
  LinkedIn or WhatsApp. Do not replace social marks with generic platform icons.
- Do not wrap decorative icons in outlined square containers unless that
  container carries an actual interaction or semantic state.
- Do not add unsupported “Ready”, “Setup complete”, forecast, confidence,
  recommendation, response-rate, or video-view badges merely to fill space.

## Existing interactions

| Interaction | Owner | Constraint |
| --- | --- | --- |
| Load overview | `apiFetch("/dashboard/overview")` | Redirect browser to `/login` only for an authenticated API 401. |
| Open billing management | `POST /billing/portal-session` | Only render/enable when `hasBillingPortal` is true. |
| Theme change | `useThemeMode()` | Preserve current light/dark state behavior. |
| Workspace navigation | `DashboardShell.tsx`, `DashboardOverviewClient.tsx`, `DashboardWorkspaceViews.tsx` | Overview uses `/dashboard`; each other section is a real nested route under `/dashboard/<section>`, no more `?view=` switching. |
| Reply to a lead | `POST` a message with a client-generated `idempotencyKey` | Prevents double-send on retry/double-click; enforced by a unique constraint, not just client debouncing. |

## Next dashboard increment

Verified as of this pass (build + 205 API tests green, source-level
confirmation against `apps/api/src/routes/dashboard.ts`):

- Overview is on real, non-fabricated data end to end: week-over-week
  trends, a real daily activity-trend chart, real per-channel send counts,
  a real insights-engine-backed recommendations panel, and a monotonic
  funnel stepper.
- Routing is real nested paths, not query-param view switching.
- Messages replies are idempotency-protected; Prospects has a real
  review/approve/exclude workflow with a detail-drawer intercepting route.

Still outstanding, in rough priority order:

1. **Top bar wiring** (Overview and shell-wide): real search against
   `GET /dashboard/prospects` / `GET /campaigns`, a functional `Popover`+
   `Calendar` date range picker (the API already supports
   `startDate`/`endDate`), and a notification bell reading the real
   `unreadNotificationCount` the API already returns.
2. **Sidebar Connected Channels block**: replace the current static status
   block with a `Collapsible` + `Card` reading real `SocialAccount` rows,
   no hardcoded channels (Email/Zapier are not real integrations, do not
   list them until they are).
3. **Dropdown consolidation**: replace remaining ad-hoc dropdown/menu JSX
   across the dashboard with shadcn's `DropdownMenu` (for actions/menus)
   or `Select` (for value pickers), preserving existing behavior exactly.
4. **Onboarding shadcn migration**: separate, later effort, same
   like-for-like constraint as the dashboard consolidation, no visual or
   behavioral change, different components (`Form`, `Progress`,
   `RadioGroup`), no shared files with the dashboard work.
5. Team and workspace-security settings remain intentionally unbuilt, no
   multi-user/team model exists yet to back them.

## Dashboard definition of done

1. Server entry protects `/dashboard` and obeys `onboardedAt`.
2. Every endpoint query has organization scope.
3. Numbers and labels come from documented persisted sources.
4. Empty data is truthful and useful.
5. Desktop does not hide activity below an unnecessary page scroll; mobile
   remains naturally scrollable.
6. Social channel display uses actual logos.
7. API tests, web typecheck, and production build pass.
