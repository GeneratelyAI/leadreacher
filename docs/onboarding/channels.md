# Channels

## Purpose

Channels links the accounts through which outreach will eventually happen. It is
the final onboarding step and requires at least one healthy required channel.

## Current user experience

- Five channels are shown, each with a real connect flow: LinkedIn, WhatsApp,
  Instagram, Gmail, and Outlook. LinkedIn is the only required channel.
- A channel is flagged with a "Recommended" badge when the Strategy generated
  earlier in onboarding recommends it. LinkedIn, WhatsApp, and email (Gmail and
  Outlook both key off the same "email" recommendation) can be flagged;
  Instagram is never flagged since the current strategy model does not score it.
- Gmail and Outlook both connect through the same underlying "email" provider
  family server-side, so connecting either one marks both rows "Connected."
  This is a deliberate product decision, not a bug — see the implementation
  notes below.
- The UI refreshes account status after the hosted connection flow returns.
- Finishing setup marks the organization onboarded, creates one Strategy-linked
  review campaign draft, and redirects to
  `/dashboard/campaigns?reviewCampaignId=...`.

## Safety boundary

Connecting an account does not send invitations, chats, follow-ups, or video.
It only authorizes and records the channel account. Delivery needs a separately
created and launched campaign.

## Implementation notes

- `SocialAccount` stores Unipile account references and display state, not a
  customer LinkedIn password or session cookie.
- Unipile normalizes Google, Outlook, Microsoft, IMAP, and generic mail
  providers to a single `email` platform value server-side
  (`apps/api/src/lib/channels.ts`). Gmail and Outlook are shown as separate
  onboarding rows to match the dashboard's channel picker, but there is no way
  to distinguish which one a user actually connected once the account exists —
  both rows match on the same platform set and flip to "Connected" together.
- Channel logos (LinkedIn, Instagram, Gmail, Outlook images; the WhatsApp
  bubble mark) live in `apps/web/src/components/onboarding/ChannelLogo.tsx`
  and are shared with the dashboard's Channels connect picker
  (`ConnectChannelMark` in `ChannelsWorkspace.tsx`) so both surfaces render
  identical brand marks.
- The "Recommended" badge reads `GET /strategy/:orgId` and parses its
  `channels.recommendations` array via the shared
  `apps/web/src/lib/onboarding/channel-recommendations.ts` helper (also used
  by the Strategy step's own recommended-channels screen). A missing or
  not-yet-generated strategy fails silently — it never blocks connecting a
  channel.
- Connected-account health is reused by dashboard engine status and future
  campaign launch validation.
- The hosted-auth callback must have a public webhook URL configured in the API
  environment.

## Operations

Use the [Unipile connection-testing runbook](../operations/unipile-connection-testing.md)
to verify a connected LinkedIn account without sending outreach.
