# Checkout

## Purpose

Checkout creates the subscription entitlement that permits outreach. It follows
Video Decision because campaign type and video configuration determine the
checkout catalog.

## User flow

1. The client requests a hosted checkout session.
2. Stripe collects payment details on its own secure page.
3. Stripe webhooks, not the browser redirect, establish subscription state.
4. A successful checkout returns the user to onboarding and unlocks Channels.

## Implementation notes

- Checkout sessions are created through the billing API and use server-side
  Stripe Price IDs.
- The video line item is always present. Video is no longer an optional toggle.
- Subscription lifecycle webhooks are the authority for `subscriptionStatus`.
  Checkout completion attaches customer and subscription records but must not
  overwrite a more current lifecycle event.
- The billing portal is available for completed organizations from the workspace.

## Operations

Environment configuration, Stripe test mode, webhook events, and validation are
documented in [onboarding billing setup](../operations/onboarding-billing-setup.md).
