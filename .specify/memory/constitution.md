<!--
Sync Impact Report
- Version change: template baseline -> 1.0.0
- Modified principles: none, initial adoption
- Added sections: Product and Data Constraints; Delivery Workflow
- Removed sections: none
- Follow-up TODOs: none
-->

# LeadReacher Constitution

## Core Principles

### I. Organization-Scoped Customer Trust
Every protected read and write MUST be authorized through the authenticated
organization. Route parameters, client state, and provider identifiers are
lookup constraints, never authority. Campaigns, prospects, uploads, channel
accounts, billing records, exports, and activity must remain isolated between
organizations. Owner-only and higher-assurance actions MUST enforce their
documented authorization requirements. This protects customers from cross-tenant
exposure and makes every action attributable to the correct organization.

### II. Truthful Campaign State
The product MUST display persisted campaign, scrape, subscription, upload, and
provider state accurately. It MUST not invent generated assets, campaign
results, readiness, entitlement, or external-account status. Loading, missing,
recoverable, pending, completed, and failed states MUST be distinct, including
after refresh, direct navigation, organization switching, and browser history.
Provider callbacks and webhooks are the authoritative source for completed
external work, especially billing and connection state. This keeps user trust
aligned with what LeadReacher can actually deliver.

### III. Accessible, Stable Product Experiences
User-facing flows MUST preserve semantic controls, keyboard operation, visible
focus, screen-reader labels, polite status announcements where state changes,
and `prefers-reduced-motion` support. Mobile and desktop layouts MUST avoid
unexpected page overflow, clipping, layout shift, unreachable actions, and
focus loss. Motion MUST communicate a user-caused state change, have a single
owner per animated property, and render an immediate equivalent for reduced
motion. Copy, documentation, tests, fixtures, comments, and source MUST NOT use
the Unicode U+2014 em dash character.

### IV. Verified, Contract-Safe Delivery
Changes MUST be validated in proportion to their risk before merge. Relevant
formatting, lint, type checks, unit tests, integration tests, browser tests,
API tests, and production builds MUST pass. Changes to persistence, API
contracts, billing, webhooks, uploads, queues, or external providers MUST add
or update focused coverage for the affected contract and failure states. CI
commands are the minimum local verification target; warnings that can fail CI,
broken imports, debug code, generated artifacts, and new console errors MUST be
resolved before delivery.

### V. Small, Explicit, Maintainable Boundaries
LeadReacher is a pnpm and Turborepo monorepo. Web concerns belong in the Next.js
application, API and worker concerns belong in the Fastify and Prisma
application, and reusable cross-boundary types belong in the shared package.
New dependencies, abstractions, animations, and background work MUST have a
clear product need and a single accountable owner. Existing shared components,
state APIs, and provider abstractions MUST be extended instead of duplicating
markup, authority, or persistence logic. Before changing Next.js code,
contributors MUST read the relevant installed Next.js documentation because the
repository uses version-specific behavior.

## Product and Data Constraints

Credentials, tokens, production URLs, and customer data MUST never be committed,
logged, included in fixtures, or copied into another environment. Local,
staging, and production resources MUST remain isolated. Staging and test
journeys MUST use controlled accounts, test-mode billing, run-scoped fixtures,
and cleanup. Production deployment, campaign launch, external message delivery,
account connection, and payment actions require explicit human authorization;
successful redirects or provider authentication alone do not prove the related
business state.

Schema changes MUST use reviewed Prisma migrations. Migrations, queues, and
campaign state MUST be recoverable and idempotent where retries or webhooks are
possible. Redis and Postgres are required runtime dependencies for readiness;
their data and volumes MUST not be deleted as a deployment shortcut. API
readiness, worker health, observability, and provider preflight checks are part
of production correctness, not optional operations work.

## Delivery Workflow

Work begins by reading repository guidance, the applicable product and
operations documentation, and the affected implementation. Feature work MUST
state user-visible behavior, data ownership, error handling, accessibility, and
verification expectations before implementation. Existing user changes in a
working tree are preserved unless the owner explicitly approves their removal.

Each coherent change MUST be reviewed as a focused diff and committed with a
conventional commit message when commits are requested. Commits MUST be
independently understandable and buildable. Hooks, protected-branch checks, and
CI requirements MUST NOT be bypassed. Deployments, production configuration,
provider credential changes, live billing, account connections, and campaign
launches require their documented approvals and runbooks.

## Governance

This constitution supersedes informal development preferences for LeadReacher.
Every plan, specification, review, and release decision MUST check compliance
with these principles. A proposed amendment MUST document the reason, affected
workflows, migration or adoption plan, and semantic version impact. The project
owner approves amendments. MAJOR versions remove or redefine a principle, MINOR
versions add or materially expand governance, and PATCH versions clarify without
changing required behavior. Compliance is reviewed during specification,
implementation, code review, CI verification, and release readiness.

**Version**: 1.0.0 | **Ratified**: 2026-09-08 | **Last Amended**: 2026-09-08
