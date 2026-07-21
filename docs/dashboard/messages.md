# Messages

## Function

Messages is a read-only operator timeline for outreach history and inbound
replies. The navigation label may become **Inbox** once reply-management
workflows are introduced.

## Current implementation

`/home?view=messages` reads organization-scoped Message records, normalizes the
stored message body, and displays lead, campaign, channel, delivery status, and
time. It does not yet let an operator compose a reply.

## Required capabilities

- List conversations by lead, campaign, channel, and reply state.
- Show the persisted sent content, including a lead-specific video URL when one
  was delivered in the first chat message.
- Allow a user to review and respond with clear human-versus-automation context.
- Track read and attention state before presenting notification badges.

## System-design notes

Unipile webhooks are duplicated in practice, so message ingestion must remain
idempotent. An inbound reply stops future automated sequence work for that lead.
