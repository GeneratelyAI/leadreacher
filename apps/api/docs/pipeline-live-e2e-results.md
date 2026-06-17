# Live E2E Pipeline — Execution Results

**Date:** 2026-06-17
**Branch:** `test/pipeline-live-e2e`
**Plan:** `apps/api/docs/pipeline-live-e2e-plan.md`
**Method:** Subagent-driven development (fresh implementer per task, task review after each, final whole-branch review).

## Summary

Tasks 1–3 (the buildable tooling + runbook) are **complete, reviewed, and committed**. Task 4 (the live outreach run) is **gated** and intentionally not executed — it sends real LinkedIn invites/messages and needs explicit go-ahead plus the recipient account ready.

Final whole-branch review (opus): **READY TO MERGE, no blockers.**

## Task results

| Task | Deliverable | Commit | Tests | Review |
|------|-------------|--------|-------|--------|
| 1 | `resolveWebhookUrl` + test; remove hardcoded ngrok URL from `recreate-unipile-webhooks.ts`; `.env.example` vars | `666b928` | 4/4 pass | Spec ✅, quality approved |
| 2 | `buildSeedLead` + test; `seed-test-lead.ts` CLI | `2fd3782` | 2/2 pass | Spec ✅, quality approved (3 ⚠️ resolved) |
| 3 | `pipeline-live-e2e-runbook.md` | `bcdeced` | n/a (doc) | Verified: all sections + commands present |
| fix | `test`/`test:watch` scripts (final-review minor) | `202e56f` | 6/6 pass | — |
| 4 | Live run | — | — | **GATED — not executed** |

Full suite: **6/6 passing** via `pnpm --filter @leadreacher/api test`.

## Review findings (resolved / accepted)

- **Task 2 ⚠️ (resolved):** reviewer could not confirm from the diff whether `buildSeedLead`'s output satisfies Prisma's `lead.create` input. Verified directly with `tsc` — no type errors in the new files; `orgId` scalar resolves via the unchecked-create variant, `enrichmentData: {}` satisfies `Json?`, and `source`/`status` are String columns (not enums).
- **Final review minor (fixed):** `apps/api/package.json` had no `test` script, so the runbook's `pnpm … test` command would have failed. Added `test` / `test:watch` (commit `202e56f`).
- **Minor (accepted, cosmetic):** `webhook-url.ts` local `WEBHOOK_URL` could be camelCase; `seed-lead.ts` `enrichmentData: Record<string, never>` is a narrow type. Left as-is.
- **Security:** no secrets committed; `.env.example` keys are empty; the runbook uses placeholders; the old ngrok host was removed from the script.
- **`test-unipile.ts` mislabel (FIXED, Step 0 of Task 4 prep):** the script's header claimed "read-only … no invites or messages," but it unconditionally ran T4 `sendConnectionInvite` + T5 `startChat` — i.e. a real invite + DM to the target slug on every run. Now **read-only by default**; T4/T5 are gated behind an explicit `--send` flag, and the docstring is corrected. This removes an accidental-outreach footgun before the live run.

## Known issues found (not fixed here — by design)

1. **`providerLinkedinId` gap (pipeline bug).** Leads without `providerLinkedinId`:
   - cannot be matched by the `new_relation` webhook (`providerLinkedinId === user_provider_id`), so the post-accept step-1 DM never fires; and
   - in the worker invite path, `sendConnectionInvite(unipileId, lead.providerLinkedinId ?? "", …)` sends with an **empty** `provider_id`, and the `provider_id` fetched from `getProfile` is never persisted back.
   Documented in the design spec and runbook; worked around by seeding the recipient with a real `provider_id`. **Recommend a separate fix task.**

2. **Pre-existing TypeScript errors.** `pnpm --filter @leadreacher/api lint` (`tsc --noEmit`) reports errors in unrelated `routes/`, `workers/`, and `services/` files. These predate this branch and are not introduced by it, but they mean `lint` is currently red repo-wide. **Worth its own cleanup task.**

## Track A live dry-run — PASSED (2026-06-17)

Ran the ingestion path against **live Apify + the test DB** (org `LeadReacher Test`), zero outreach, via a temporary direct-call script (removed after).

- **Scrape:** Apify `harvestapi~linkedin-profile-search` returned 2 profiles in ~24s with `{jobTitles:["Software Engineer"], locations:["United States"], maxResults:2}`. Normalization correct — `firstName/lastName/title/company/linkedinUrl/providerLinkedinId` all populated.

  | firstName | lastName | title | company | linkedinUrl | providerLinkedinId |
  |---|---|---|---|---|---|
  | Aman | Mohamed | Deployment Engineer @ Rolls-Royce | Rolls-Royce | https://www.linkedin.com/in/amanmoha | `ACoAADxZPqQBjGrMu3f-dtL5mrv-dWhufm5RZoE` |
  | Francis | Frenzel | Staff Software Engineer @ Apptronik | Apptronik | https://www.linkedin.com/in/francis-frenzel-6a7ab623b | `ACoAADvJD18BLJYG4Anir-1O7S0NBN539h4yWsA` |

  (`title` carries the LinkedIn headline; `company` is parsed from `currentPosition[0]`. Both rows were deleted after the run — see Cleanup.)
- **Import:** first run `{imported: 2, skipped: 0}`.
- **Dedup:** re-import of the same profiles `{imported: 0, skipped: 2}` → dedup by `linkedinUrl` works.
- **Cleanup:** the 2 test rows were deleted afterward; org restored to its prior 5 leads. No outreach sent.

Prereq gap found: a fresh environment needs `pnpm --filter @leadreacher/api exec prisma generate` before any DB access (otherwise `prisma.<model>` is undefined). Added to the runbook §0.

## Track B live run — PASSED (2026-06-17)

Ran the full outreach loop against live Unipile + LinkedIn. Sender: `1R_YeXrqSWi7WgnIgYge7w` (Nicolas Miranda Cantanhede). Recipient: `kaiyue-wei` (Kaiyue Wei, provider `ACoAAFLwQeoBo3MT1-d462S7HxpOpMfnilpboY8`, SECOND_DEGREE at start). Campaign `cmqibrtae…s8jx`, campaign-lead `cmqibrtdo…3080`.

| Checkpoint | Action | Result | Evidence |
|---|---|---|---|
| 1 | launch (enqueue step 0) | invite sent | job `completed` `{sent:true,path:"invite-sent"}`; lead→`contacted`; msg step0 `sent`; currentStep→1 |
| 2 | accept invite (manual) → step-1 | DM sent | lead→`connected`; chat `7Bdlt08bULW1mIzyFRLjTA`; msg step1 `sent`; currentStep→2; step-2 scheduled (`delayed:1`) |
| 3 | reply (manual) | replied + follow-up cancelled | inbound webhook `inbound:true`; lead/campaign-lead/msgs→`replied`; **`delayed:1→0`** (step-2 cancelled); inbound msg stored |

**Findings:**
1. **`new_relation` did not arrive (HIGH-value finding).** After accept, Unipile's `new_relation` webhook **never arrived within a ~10-min watch window** (background watcher timed out; only 4 webhook POSTs total, all `message_received`). So the post-accept step-1 DM did **not** auto-fire. Messages (`message_received`) are near-instant; relations lag badly or require a separate sync. We triggered step-1 deterministically via the same `deliverSequenceStep1ViaChat` path. **Recommendation:** do not rely on `new_relation` for the post-accept DM — add a reconciliation fallback (periodically re-check `network_distance`/`is_relationship` for `contacted` leads and advance to step 1 when first-degree). This is arguably the most important production finding from the run.
2. **`providerLinkedinId` workaround validated.** Because the lead was seeded with the real `provider_id`, the invite was sent with a correct id (not the empty-string bug documented under Known issues). Confirms both the bug and the seeding workaround.
3. **`startChat` reused the existing thread.** The invite-note created a chat; step-1 `startChat` returned that same `chat_id` rather than a duplicate.
4. **Reply cancellation works.** The queued step-2 follow-up was removed on reply (`delayed:1→0`), so no follow-up is sent after a reply — correct behavior.
5. **Webhook idempotency race (MEDIUM — real bug).** The single inbound reply (`message_id spg824EMX2ymH88oWhd76g`, text `"step1-dm received"`) was stored **twice** — two `Message` rows with the *same* `externalId`. The handler dedups via `isDuplicate(message_id)`, a **read-then-write** with **no unique constraint on `Message.externalId`**, so an at-least-once / concurrent webhook re-delivery can slip past the check and double-insert. (Confirmed receipt of the message body works; the defect is the dedup, not the receive.) **Recommendation:** add a unique constraint on `Message.externalId` and make the insert an upsert / catch `P2002` — the same backstop pattern already used for `CampaignLead.linkedinChatId`. The `isDuplicate` read alone is not race-safe. *(One duplicate row was deleted post-run to tidy the test data; the bug remains to be fixed.)*

**Note on method:** the run was driven via direct service/queue calls (not the HTTP routes) because no Supabase test token was available; the worker, adapters, webhooks, and queue — the live-integration surface — were all exercised. The HTTP route layer (`/leads/scrape`, `/campaigns`, `/launch`, `/social-accounts/sync`) was not exercised in this run.
