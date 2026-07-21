# Campaigns

## Function

Campaigns is the control surface for drafting and explicitly launching LinkedIn
outreach campaigns.

## Current implementation

`/home?view=campaigns` lists persisted campaigns and creates a draft only after
the operator enters a campaign name, connection note, and first post-connection
message. An active LinkedIn account is required. Launch remains an explicit API
action and does not occur when creating a draft.

## Required capabilities

- Create a campaign from reviewed operator-provided copy.
- Review message sequence and channels before launch.
- Add and approve prospects before launch.
- Show draft, review, active, paused, and completed states.
- Require an explicit final launch confirmation before external delivery begins.
- Pause/resume and richer sequence editing remain future work.

## System-design constraints

- Launch queues one step-zero job per enrolled lead.
- Delivery reservations and provider idempotency protect against duplicate sends.
- A personalized asset must be ready before the first post-connection chat is
  sent; a failed asset blocks that lead rather than sending text-only.
