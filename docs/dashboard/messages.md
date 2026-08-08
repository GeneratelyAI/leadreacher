# Messages

## Function

Messages is an operator inbox for outreach history and inbound replies: an
AI-drafted, human-approved reply is sent only after explicit operator action.

## Current implementation

`/dashboard/messages` (`GET /dashboard/messages`) lists organization-scoped
conversations - lead, campaign, channel, delivery status, and time - filterable
by `all` / `unread` / `needs_reply`. Opening a conversation
(`GET /dashboard/conversations/:campaignLeadId`) loads its full message
history. `POST .../drafts` generates an AI reply draft via
`runReplyDraftAgent`; the operator edits it, then `POST .../replies` sends it,
idempotency-protected by a client-supplied key and gated on the daily
per-sender send limit.

Sending a reply is currently **LinkedIn-only**: it requires the conversation to
have a `linkedinChatId` and an active LinkedIn sender account, and requires at
least one inbound message from the prospect first (an operator cannot open a
conversation).

## Required capabilities

- List conversations by lead, campaign, channel, and reply state.
- Show the persisted sent content, including a lead-specific video URL when one
  was delivered in the first chat message.
- Generate an AI-drafted reply, let the operator edit it, and send only after
  explicit confirmation.
- Extend real reply sending to WhatsApp/Instagram/email once those channels
  have their own delivery paths (LinkedIn-only today).
- Track read and attention state before presenting notification badges.

## System-design notes

Unipile webhooks are duplicated in practice, so message ingestion must remain
idempotent. An inbound reply stops future automated sequence work for that lead.
