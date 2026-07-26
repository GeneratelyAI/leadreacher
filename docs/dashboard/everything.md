# Dashboard Architecture and Navigation

## Sidebar order

1. Overview
2. Campaigns
3. Prospects
4. Messages
5. Channels
6. Analytics
7. Settings

This follows the operating sequence: understand the workspace, configure and
run campaigns, work prospects, handle replies, manage delivery accounts, review
results, then administer the organization.

## Route and access model

- `/home` is the dashboard entry route.
- Unauthenticated visitors are redirected to `/login`.
- Organizations without `onboardedAt` are redirected to the correct onboarding
  resume step.
- Completed organizations are redirected from `/onboarding` to `/home`.
- All dashboard API queries must scope through the authenticated organization.

## Current section capabilities

All sidebar sections are operational through the `view` query parameter on
`/home`. Each keeps a narrow, explicit first-release scope:

- **Overview** shows engine health, counts, activity, channel health, and
  attention items.
- **Campaigns** creates a reviewed LinkedIn draft with user-provided invite and
  first-message copy, lists drafts, and calls the explicit launch endpoint.
- **Prospects** lists records, updates their lifecycle status, and enrolls
  selected prospects in a chosen campaign.
- **Messages** lists persisted inbound and outbound records. It does not yet
  provide reply composition or read-state management.
- **Channels** lists accounts, syncs their provider state, and starts LinkedIn
  hosted authorization. It does not send outreach.
- **Analytics** reports persisted message and lifecycle totals without trends or
  inferred performance.
- **Settings** updates workspace name and exposes Billing Portal when eligible.

## Shared design decisions

- The dashboard is an operations tool, not a marketing page. Prioritize scanable
  data, clear state, and explicit actions.
- Use a fixed shell with a stable sidebar and header. Let only the workspace
  canvas scroll when content exceeds the viewport.
- Use actual social-platform marks for channel identity.
- Preserve keyboard focus states, semantic landmarks, and reduced-motion
  behavior.
- Avoid decorative-only UI that competes with operating signals.

## Campaign launch boundary

Onboarding configures strategy, billing, video choices, and a channel. When the
user finishes onboarding, the API creates one reviewable LinkedIn Campaign
draft from the saved strategy and routes the user to that draft. It does not
enroll prospects or send outreach. The user must edit and save the connection
note, add approved prospects, and confirm the launch before delivery begins.
