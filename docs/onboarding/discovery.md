# Discovery

## Purpose

Discovery establishes the organization's business context from its website and
one explicit competitive-advantage answer. It is the first required onboarding
step.

## User flow

1. The landing page captures a website URL and stores it for the signup flow.
2. After authentication, the website scrape runs and exposes market, offer,
   audience, value, and strategy status.
3. A user who entered through signup without a URL sees an in-flow website gate
   before the Discovery question.
4. The user answers what makes the business different and submits it to
   `/discovery/complete`.

## Implementation notes

- Scrape status is shared by the auth insight panel and Discovery through the
  website-scrape status hook.
- Anonymous pre-auth results are promoted to the authenticated organization
  during bootstrap so landing-page insight work is not lost at signup.
- Scrape data is associated with its source URL and organization to prevent
  stale results from another website or account appearing in Discovery.
- Completion creates or updates the organization's Strategy context used by the
  following steps.

## Failure behavior

An absent URL is handled by the website gate. A failed scrape remains an
explicit status rather than fabricated business data. The user can correct the
URL and start a new scrape.
