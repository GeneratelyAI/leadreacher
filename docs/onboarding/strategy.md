# Strategy

## Purpose

Strategy transforms Discovery context into an audience, positioning, and channel
recommendation that can be reviewed before campaign decisions are made.

## User flow

The Strategy step has three query-backed substeps:

1. `how-it-works`: explains the acquisition workflow and initiates analysis when
   required.
2. `targeting`: shows reachable audience, industry, persona, and company data.
3. `channels`: shows recommended channels and confidence information.

## Implementation notes

- The current location is `/onboarding?step=strategy&substep=<substep>`.
- Resume behavior avoids regenerating completed audience analysis on refresh.
- The backend uses Discovery market and audience language to derive search
  filters. Industry, company-size, and location extraction only apply when the
  text contains a real signal. No default geography or company size is invented.
- Apify company search can be skipped deliberately when there is no defensible
  search criterion. Decision-maker results can still be useful in that partial
  state.

## Data produced

Strategy persists audience definition, business positioning, messaging angles,
and channel recommendations. Later onboarding steps read this persisted Strategy
instead of re-deriving it in the browser.
