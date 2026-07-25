# Phase 0 — Unipile multi-channel spike

Date: 2026-07-24  
Constraint: Unipile only (no Smartlead / second ESP).

## Confirmed Unipile capabilities

| Channel | Connect (hosted auth) | Send | Inbound |
|---------|----------------------|------|---------|
| LinkedIn | `LINKEDIN` | Invite + `/chats` | `new_relation`, `message_received` |
| WhatsApp | `WHATSAPP` | `/chats` start + send | `message_received` (messaging source) |
| Facebook Messenger | `MESSENGER` (hosted) — normalize to `facebook` | `/chats` with Messenger attendee id | `message_received` |
| Instagram | `INSTAGRAM` | `/chats` using `provider_messaging_id` | `message_received` |
| Email | `GOOGLE` / `OUTLOOK` / `MAIL` | `POST /emails` (multipart) | Email webhook source (mail received) |

### Messaging attendee IDs (`POST /chats` → `attendees_ids`)

- **LinkedIn:** classic `provider_id` (`ACo…` / `ACw…` / `AE…`)
- **WhatsApp:** `{phone}@s.whatsapp.net` (digits only before `@`, country code required)
- **Instagram:** `provider_messaging_id`
- **Messenger:** provider messaging / PSID-style attendee id from Unipile user lookup

### Email

- Send: `POST /api/v1/emails` with `account_id`, `to[]`, `subject`, `body`
- Tracking optional (`opens`, `links`)
- Reply matching: inbound mail webhook → match by account + recipient email / thread headers

## Product decisions locked for implementation

1. **Reply behavior:** any inbound reply on a campaign lead cancels remaining sequence jobs for that lead (same as LinkedIn today). Channel-scoped pause can come later.
2. **Sequence model:** interleaved steps; channel derived from `type` (`linkedin_*`, `whatsapp_message`, `facebook_message`, `instagram_message`, `email`).
3. **Senders:** one SocialAccount per channel per campaign (`CampaignChannelAccount`). Legacy `Campaign.socialAccountId` remains the LinkedIn sender mirror for back-compat.
4. **Chat storage:** add `CampaignLead.providerChatId` (generic). Keep writing `linkedinChatId` when channel is LinkedIn for transition; lookups accept either.

## Gaps closed by Phases 1–7

- Connect enum + UI for WA / Messenger / email
- Lead identity fields + phone normalization
- Channel-aware sequence validation
- Adapter `sendEmail` + WhatsApp attendee helper
- Worker router (no LinkedIn-only hard gate)
- Webhooks set `Message.channel` from `SocialAccount.platform`
- Sequence builder + Channels workspace enablement
