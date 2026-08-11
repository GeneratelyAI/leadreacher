# Live End-to-End Test of the Apify→Unipile Pipeline - Design

**Date:** 2026-06-16
**Status:** Approved (design), pending spec review
**Owner:** Kaiyue

## Goal

Prove the lead pipeline works against real services, end to end: Apify scrape → lead import → campaign enrollment → Unipile connection invite → invite accepted → first DM → reply handling. Capture edge cases and failure modes found during the run.

## Why this shape

The literal task is "run the full flow end to end and find edge cases." That is a **live, one-time verification**, not an automated regression suite (the suite is tracked separately). The flow sends **real, irreversible LinkedIn outreach** and carries account-ban risk, so the run is designed around two safety principles:

1. **Two tracks.** `POST /leads/scrape` returns real strangers. Scraped people are verified for *ingestion correctness only* and are **never enrolled** in a campaign. All outreach goes to a single recipient account we control.
2. **Controlled recipient.** Both ends of the conversation are accounts we own (confirmed available): a **sender** connected to Unipile, and a **recipient** that we manually accept/reply on to drive the webhook paths.

## Accounts & environment (confirmed / to set up)

- **Sender:** a LinkedIn account connected to Unipile (health to be verified via `test-unipile.ts`).
- **Recipient:** a separate LinkedIn account we control. **Must not already be a 1st-degree connection of the sender** - otherwise the worker takes the `already-connected` branch and skips the invite/accept paths.
- **Webhook delivery:** not yet set up. The run uses a local API + **ngrok tunnel**; `recreate-unipile-webhooks.ts` registers the `message_received` and `new_relation` webhooks at the tunnel URL. (The script currently hardcodes the URL; it will be parameterized via env.)

## Architecture (existing system under test)

- **API:** Fastify (`apps/api`), protected routes scoped by `orgId` (Supabase JWT).
- **Worker:** BullMQ `campaign-sequence` worker, started **in-process** with the API (`server.ts:47`); Redis is Upstash. Retry policy: 3 attempts, exponential backoff from 5s.
- **Adapters:** `ApifyAdapter` (LinkedIn profile search actor) and `UnipileAdapter` (profile lookup, invite, chat).
- **Webhooks:** `POST /webhooks/unipile` handles `new_relation` (invite accepted → send step-1 DM) and `message_received` (reply → mark replied, cancel pending jobs). Auth via constant-time `Unipile-Auth` header check.

## Section 1 - Prerequisites (all green before any outreach)

1. Postgres migrated; Upstash Redis reachable; API running (`pnpm dev:api`).
2. `test-unipile.ts` passes T1–T3; record sender Unipile `account_id`.
3. ngrok tunnel up; `recreate-unipile-webhooks.ts` run with the tunnel URL; both webhooks visible in the Unipile dashboard; `UNIPILE_WEBHOOK_SECRET` matches the registered header.
4. Supabase test user exists; `get-test-token.ts` yields an access token. Its org scopes all test data.
5. **A `SocialAccount` row** exists for the test org: `platform: "linkedin"`, `status: "active"`, `unipileId = sender account_id`. Without it the worker throws `No active LinkedIn account for org`.

## Section 2 - Track A: Ingestion verification (no outreach)

- `POST /leads/scrape` with small filters and `maxResults: 2`.
- Assert response `{ imported, skipped, total }`; verify rows in DB: `source: "apify"`, correct `firstName/lastName/title/company/linkedinUrl/providerLinkedinId`, `enrichmentData` present.
- Re-run identical filters → confirm dedup (`skipped` increases, no new rows).
- **Stop. Scraped leads are not enrolled.**

## Section 3 - Track B: Outreach loop (controlled recipient)

**Known bug surfaced during design (documented, not fixed in this task):**
The seeded recipient lead **must have `providerLinkedinId` populated**, because:
- The `new_relation` webhook matches the lead by `providerLinkedinId === user_provider_id`. CSV-imported leads have `providerLinkedinId = null`, so the accept webhook would never match → step 1 never fires.
- In the worker invite path, `sendConnectionInvite(unipileId, lead.providerLinkedinId ?? "", message)` sends with an **empty `provider_id`** when null, and the `provider_id` fetched from `getProfile` is never persisted back to the lead.

The runbook works around this by seeding `providerLinkedinId` directly. The fix is out of scope here and will be filed as a separate task.

**Flow:**
1. Get the recipient's `provider_id`: `test-unipile.ts <senderAccountId> <recipientSlug>` (T3 prints it).
2. Seed one lead = the recipient, **with `providerLinkedinId` set**, via a small `seed-test-lead.ts` script (direct insert; neither scrape nor CSV sets it reliably for a chosen person).
3. Create a campaign (`POST /campaigns`) with a sequence: step 0 `connection` (`delayHours: 0`), step 1 `message` (the DM), optional step 2 follow-up with a short `delayHours`.
4. Enroll the recipient lead; launch (`POST /campaigns/:id/launch` → `addBulk` step-0 jobs).
5. **Invite:** worker logs `campaign-sequence-step0 path: invite-sent`; `Message`(stepIndex 0, `sent`), `Lead.status: contacted`, `CampaignLead.currentStep: 1`; invite arrives on recipient.
6. **Accept on recipient** → `new_relation` webhook → `Lead.status: connected`; step-1 DM via `startChat`; `CampaignLead.linkedinChatId` set, `currentStep: 2`; step 2 scheduled; DM arrives.
7. **Reply on recipient** → `message_received` webhook → Lead/CampaignLead/Message statuses → `replied`; pending step-2 job cancelled (verify it never fires); inbound `Message` created.

## Section 4 - Observability

The runbook contains a checkpoint table: **action → expected structured log event → expected DB state** (`Lead`, `CampaignLead`, `Message`), so every step has an explicit pass/fail gate.

## Section 5 - Failure modes to capture

- `providerLinkedinId` gap (above).
- Tunnel down / webhook unreachable → flow stalls at `invite-sent`.
- Sender checkpoint/unhealthy → `getProfile` fails → 3× retry/backoff then job failure.
- Duplicate webhook deliveries → idempotency via `message_id` / `externalId`.
- Reply arriving during the step-2 delay → cancellation race.
- Large scrape → `maxItems` cap (default 100) and the 120s poll timeout.

## Deliverables

- `docs/video/live-e2e-runbook.md` - procedure + observability table + findings section (filled in during the run).
- `apps/api/src/scripts/seed-test-lead.ts` - seeds the recipient lead with `providerLinkedinId`.
- Parameterize the webhook URL in `recreate-unipile-webhooks.ts` (read from env, default to current value).

## Out of scope

- Fixing the `providerLinkedinId` bug (separate task).
- The automated regression test suite (separate plan: `2026-06-16-pipeline-test-suite.md`).
- Sending outreach to any scraped/real third parties.

## Success criteria

- Track A: scraped leads land correctly and dedup works.
- Track B: every transition in Section 3 reaches its expected log + DB state, ending with the recipient lead and campaign-lead in `replied` and no orphaned step-2 job.
- Findings section lists each edge case observed, with evidence (log lines / DB rows).
