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

## What remains: Task 4 (live run)

Execute `apps/api/docs/pipeline-live-e2e-runbook.md` once the recipient burner account is ready and you give the go-ahead. Track A (scrape/ingest, no outreach) can run first as a low-risk warm-up; Track B (invite → accept → DM → reply) is the gated outreach loop. Record observations in the runbook's §4 Findings.
