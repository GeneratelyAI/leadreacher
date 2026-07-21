# Prospects

## Function

Prospects shows people and companies discovered or imported for an organization
and supports deliberate lifecycle updates and campaign enrollment.

## Current implementation

`/home?view=prospects` lists up to 100 organization-scoped records, updates the
persisted Lead status, and enrolls selected prospects in a chosen campaign.

## Required capabilities

- Search, filters, detailed enrichment, and campaign-membership inspection are
  future work.
- Review reachable contact/channel data as available.
- Approve, exclude, or enroll prospects deliberately before launch.
- Explain missing or incomplete enrichment rather than fabricating it.

## System-design notes

Apify and enrichment data can be partial. The UI must separate observed profile
data from Strategy estimates and never represent a broad LinkedIn result count
as a precise addressable market.
