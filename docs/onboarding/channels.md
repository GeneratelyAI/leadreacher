# Channels

## Purpose

Channels links the accounts through which outreach will eventually happen. It is
the final onboarding step and requires at least one healthy required channel.

## Current user experience

- LinkedIn is the active connection path through Unipile hosted authentication.
- WhatsApp Business and Email are shown as future channels in the onboarding UI.
- The UI refreshes account status after the hosted connection flow returns.
- Finishing setup marks the organization onboarded and redirects to `/home`.

## Safety boundary

Connecting an account does not send invitations, chats, follow-ups, or video.
It only authorizes and records the channel account. Delivery needs a separately
created and launched campaign.

## Implementation notes

- `SocialAccount` stores Unipile account references and display state, not a
  customer LinkedIn password or session cookie.
- Connected-account health is reused by dashboard engine status and future
  campaign launch validation.
- The hosted-auth callback must have a public webhook URL configured in the API
  environment.

## Operations

Use the [Unipile connection-testing runbook](../operations/unipile-connection-testing.md)
to verify a connected LinkedIn account without sending outreach.
