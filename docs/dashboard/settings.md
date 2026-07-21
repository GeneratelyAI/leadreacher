# Settings

## Function

Settings groups organization administration that does not belong in the daily
outreach workflow.

## Current implementation

`/home?view=settings` updates the persisted organization name and exposes
Stripe Billing Portal for eligible organizations. Plan and subscription state
are displayed from the server-authoritative Organization record.

## Required capabilities

- Team/member controls, integration settings, and other preferences remain
  future work.

## System-design notes

Billing entitlement is server-authoritative. UI state must not be treated as
proof that a subscription is active; verified Stripe lifecycle events define the
organization subscription status.
