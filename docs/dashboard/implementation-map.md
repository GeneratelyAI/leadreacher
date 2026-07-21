# Dashboard Implementation Map

Use this document to implement LeadReacher after onboarding. The dashboard is
an operations workspace, not a marketing landing page. It must render only
real, organization-scoped operating data and make unavailable areas explicit.

## Current product boundary

`/home` is the permanent destination for a completed organization. All sidebar
views are operational through `?view=campaigns|prospects|messages|channels|analytics|settings`.

The dashboard creates drafts and launches campaigns only after an explicit user
action. The operating workflow is:

```text
completed onboarding
  -> create a reviewed campaign draft
  -> add and approve prospects
  -> review first outreach and channels
  -> user confirms launch
  -> existing sequence worker delivers outreach
```

## Runtime entry points

| Responsibility | Current file | Notes |
| --- | --- | --- |
| Authenticated `/home` server entry | `apps/web/src/app/home/page.tsx` | Redirects unauthenticated users to `/login`; redirects incomplete orgs to `/onboarding`; renders the client dashboard only for completed orgs. |
| Overview UI and shell | `apps/web/src/components/dashboard/HomeDashboardClient.tsx` | Owns the Overview sidebar, header, responsive layout, API loading/error states, billing portal action, and actual social marks. |
| Operational workspace views | `apps/web/src/components/dashboard/DashboardOperationsClient.tsx` | Owns Campaigns, Prospects, Messages, Channels, Analytics, and Settings behind the `view` query parameter. |
| Dashboard API | `apps/api/src/routes/dashboard.ts` | Owns organization-scoped aggregation and activity normalization. |
| Protected route registration | `apps/api/src/plugins/protected-routes.ts` | Registers `dashboardRoutes` after JWT and organization middleware. |
| API tests | `apps/api/src/routes/__tests__/dashboard.test.ts` | Covers aggregate data, activity order, and engine precedence. |

## Route and navigation contract

| Navigation item | Status | Current behavior |
| --- | --- | --- |
| Overview | Operational | `/home` uses `GET /dashboard/overview`. |
| Campaigns | Operational | `/home?view=campaigns` uses existing `/campaigns` draft and launch endpoints. |
| Prospects | Operational | `/home?view=prospects` uses existing `/leads` and campaign enrollment endpoints. |
| Messages | Operational | `/home?view=messages` uses `GET /dashboard/messages`. It is read-only. |
| Channels | Operational | `/home?view=channels` uses social-account list, sync, and hosted-auth endpoints. |
| Analytics | Operational | `/home?view=analytics` uses `GET /dashboard/analytics`. |
| Settings | Operational | `/home?view=settings` uses `GET/PATCH /dashboard/settings`. |

Each active view includes loading, empty, and error states. Do not add a new
route merely because a navigation item is visible.

## Operational API contracts

The workspace client must use these existing, protected endpoints. Every call
is organization scoped by the API from the authenticated request. Never pass an
organization ID from the browser as a substitute for that scope.

| View | Read contract | Mutations | Important boundary |
| --- | --- | --- | --- |
| Campaigns | `GET /campaigns`, `GET /social-accounts` | `POST /campaigns`, `POST /campaigns/:id/launch` | Creating a draft sends nothing. Launch is explicit and existing API validation requires enrolled leads. |
| Prospects | `GET /leads?limit=100`, `GET /campaigns` | `PATCH /leads/:id`, `POST /campaigns/:id/leads` | Do not fabricate approval data. A selected record is only enrolled after the user chooses a campaign. |
| Messages | `GET /dashboard/messages` | None in this release | Read-only persisted delivery and inbound-reply timeline. Do not add a reply control without a channel-specific delivery design. |
| Channels | `GET /social-accounts` | `POST /social-accounts/sync`, `POST /social-accounts/connect` | Hosted authorization can return to `/home?view=channels`; it authorizes/syncs an account and does not send messages. |
| Analytics | `GET /dashboard/analytics` | None | Show factual totals only. No forecasts, response rates, or trend deltas unless a persisted source is added. |
| Settings | `GET/PATCH /dashboard/settings` | `POST /billing/portal-session` | The first-release editable setting is the organization name. Open Billing Portal only when the API says it is available. |

## `GET /dashboard/overview` contract

Endpoint: `GET /dashboard/overview`

Authentication: required. The API obtains `orgId` from `request.orgId`; every
query must remain scoped to that organization.

Response shape:

```ts
type DashboardOverview = {
  organization: {
    name: string;
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
  };
  primaryCampaign: {
    id: string;
    name: string;
    status: string;
    channels: string[];
    prospectCount: number;
    createdAt: string;
    updatedAt: string;
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
  }>;
};
```

### Data rules

| UI value | Persisted source | Do not substitute with |
| --- | --- | --- |
| Prospects | `Lead` count for the organization | scraped estimate or sample data |
| Outreach in progress | active `CampaignLead` count for organization campaigns | campaign capacity |
| Replies | `Lead.status = replied` | sentiment estimate |
| Meetings booked | `Lead.status = meeting` | calendar guess |
| Sent outreach | outbound `Message` count | queued jobs |
| Primary campaign | active campaign, else most recently updated draft/review campaign | automatically-created campaign |
| Channel health | persisted `SocialAccount.status` | a logo alone or provider availability |
| Activity | persisted messages, leads, video assets, campaigns, sorted newest first | invented views, opens, or trend events |

### Engine status precedence

Call `resolveDashboardEngine()` rather than duplicating this logic in a client:

1. Subscription is not `active`: `needs_attention`, billing.
2. No active channel: `needs_attention`, connect a channel.
3. No active campaign: `ready`, ready to launch.
4. Otherwise: `running`.

The order is intentional. A running campaign must not hide a broken billing or
channel prerequisite.

## UI composition and layout rules

`HomeDashboardClient.tsx` has these stable regions:

1. Fixed desktop sidebar and compact mobile navigation.
2. Fixed top bar with search placeholder, workspace context, theme control, and
   notifications placeholder.
3. Overview header with engine copy and optional billing-portal action.
4. Four metric cells.
5. Primary campaign or ready-to-create state.
6. Recent activity.
7. Channel health and attention items.

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
| Workspace navigation | `HomeDashboardClient.tsx` and `DashboardOperationsClient.tsx` | Overview uses `/home`; each operational workspace view uses `/home?view=<section>`. |

## Next dashboard increment

The next increment should add campaign sequence editing and confirmation,
prospect filters and approval, threaded reply handling, deeper channel recovery,
date-range analytics, and team settings. Each addition still needs a clear API
contract, organization-isolation test, and a meaningful loading, empty, and
failure state.

## Dashboard definition of done

1. Server entry protects `/home` and obeys `onboardedAt`.
2. Every endpoint query has organization scope.
3. Numbers and labels come from documented persisted sources.
4. Empty data is truthful and useful.
5. Desktop does not hide activity below an unnecessary page scroll; mobile
   remains naturally scrollable.
6. Social channel display uses actual logos.
7. API tests, web typecheck, and production build pass.
