# Live E2E Pipeline Test — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Design spec:** `apps/api/docs/pipeline-live-e2e-design.md` (approved 2026-06-16).

**Goal:** Produce the tooling (configurable webhook URL, a recipient-seeding script) and the runbook needed to run the Apify→Unipile pipeline end to end against real services, then execute that run and record findings.

**Architecture:** Tasks 1–2 are small, test-first code changes that make the existing ops scripts safe and repeatable. Task 3 writes the runbook (the operational deliverable) using the real, verified API endpoints. Task 4 is the **gated live execution** — it sends real LinkedIn outreach and is performed by a human following the runbook, never by an automated subagent.

**Tech Stack:** TypeScript (ESM/NodeNext), Vitest, Zod, Prisma, Fastify, BullMQ, Unipile/Apify HTTP APIs, ngrok, curl.

## Global Constraints

- Package manager **pnpm 9.15.9**; API package `@leadreacher/api` at `apps/api`. Run filtered: `pnpm --filter @leadreacher/api …` or `cd apps/api`.
- ESM **NodeNext**: relative imports MUST end in `.js`, including in tests.
- Tests import from `"vitest"` explicitly; run with `pnpm --filter @leadreacher/api test`.
- **No outreach to scraped strangers.** Track A (scrape) is verified for ingestion only and never enrolled. All outreach targets one recipient account we control.
- **Task 4 requires explicit human go-ahead** and a recipient that is **not already a 1st-degree connection** of the sender. Do not execute it autonomously.
- New env vars are read directly from `apps/api/.env` by scripts (do not route them through `config/env.ts`, which also requires DB vars).

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/api/src/lib/webhook-url.ts` | **new** — `resolveWebhookUrl(env)` pure resolver |
| `apps/api/src/lib/webhook-url.test.ts` | **new** — resolver tests |
| `apps/api/src/scripts/recreate-unipile-webhooks.ts` | **modify** — use `resolveWebhookUrl`, drop hardcoded URL |
| `apps/api/src/lib/seed-lead.ts` | **new** — `buildSeedLead(input)` pure builder |
| `apps/api/src/lib/seed-lead.test.ts` | **new** — builder tests |
| `apps/api/src/scripts/seed-test-lead.ts` | **new** — CLI that inserts the recipient lead |
| `apps/api/docs/pipeline-live-e2e-runbook.md` | **new** — the executable runbook + findings |
| `apps/api/.env.example` | **modify** — document `UNIPILE_WEBHOOK_URL` / `PUBLIC_BASE_URL` |

---

### Task 1: Make the webhook URL configurable (remove the hardcoded ngrok URL)

`recreate-unipile-webhooks.ts` hardcodes the tunnel URL, so every run requires hand-editing the source. Extract a pure resolver, test it, and wire it in.

**Files:**
- Create: `apps/api/src/lib/webhook-url.ts`
- Test: `apps/api/src/lib/webhook-url.test.ts`
- Modify: `apps/api/src/scripts/recreate-unipile-webhooks.ts`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Produces: `resolveWebhookUrl(env: Record<string, string | undefined>): string` — returns `env.UNIPILE_WEBHOOK_URL` (trimmed) if set; else `${env.PUBLIC_BASE_URL}/webhooks/unipile` (trailing slash on base trimmed) if `PUBLIC_BASE_URL` set; else throws `Error` with a setup message.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/lib/webhook-url.test.ts
import { describe, expect, it } from "vitest";
import { resolveWebhookUrl } from "./webhook-url.js";

describe("resolveWebhookUrl", () => {
  it("returns the explicit UNIPILE_WEBHOOK_URL when set", () => {
    expect(
      resolveWebhookUrl({ UNIPILE_WEBHOOK_URL: "https://x.ngrok.dev/webhooks/unipile" }),
    ).toBe("https://x.ngrok.dev/webhooks/unipile");
  });

  it("builds from PUBLIC_BASE_URL and trims a trailing slash", () => {
    expect(resolveWebhookUrl({ PUBLIC_BASE_URL: "https://x.ngrok.dev/" })).toBe(
      "https://x.ngrok.dev/webhooks/unipile",
    );
  });

  it("prefers the explicit URL over PUBLIC_BASE_URL", () => {
    expect(
      resolveWebhookUrl({
        UNIPILE_WEBHOOK_URL: "https://explicit.dev/webhooks/unipile",
        PUBLIC_BASE_URL: "https://base.dev",
      }),
    ).toBe("https://explicit.dev/webhooks/unipile");
  });

  it("throws when neither var is set", () => {
    expect(() => resolveWebhookUrl({})).toThrow(/UNIPILE_WEBHOOK_URL|PUBLIC_BASE_URL/);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @leadreacher/api test src/lib/webhook-url.test.ts`
Expected: FAIL — cannot resolve `./webhook-url.js`.

- [ ] **Step 3: Implement the resolver**

```ts
// apps/api/src/lib/webhook-url.ts
const WEBHOOK_PATH = "/webhooks/unipile";

export function resolveWebhookUrl(
  env: Record<string, string | undefined>,
): string {
  const explicit = env.UNIPILE_WEBHOOK_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const base = env.PUBLIC_BASE_URL?.trim();
  if (base) {
    return `${base.replace(/\/+$/, "")}${WEBHOOK_PATH}`;
  }

  throw new Error(
    "Set UNIPILE_WEBHOOK_URL (full URL) or PUBLIC_BASE_URL (host) in apps/api/.env to register webhooks",
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @leadreacher/api test src/lib/webhook-url.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire it into the recreate script**

In `apps/api/src/scripts/recreate-unipile-webhooks.ts`:
1. Add import at top: `import { resolveWebhookUrl } from "../lib/webhook-url.js";`
2. Delete the `const WEBHOOK_URL = "https://antler-concert-unluckily.ngrok-free.dev/webhooks/unipile";` declaration.
3. Inside `main()`, after the `config({ path… })` is already loaded, set:

```ts
  const WEBHOOK_URL = resolveWebhookUrl(process.env);
```

(Place it before the first `console.log` that references `WEBHOOK_URL`.)

- [ ] **Step 6: Document the env vars**

In `apps/api/.env.example`, under the `# Unipile` block add:

```dotenv
# Webhook registration target (set one; UNIPILE_WEBHOOK_URL wins)
UNIPILE_WEBHOOK_URL=
PUBLIC_BASE_URL=
```

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm --filter @leadreacher/api lint`
Expected: clean.

```bash
git add apps/api/src/lib/webhook-url.ts apps/api/src/lib/webhook-url.test.ts apps/api/src/scripts/recreate-unipile-webhooks.ts apps/api/.env.example
git commit -m "feat(api): make Unipile webhook URL configurable via env"
```

---

### Task 2: Recipient-seeding script (with `providerLinkedinId`)

Track B needs a lead that is the recipient account **with `providerLinkedinId` populated** (see the design's bug finding). Build a tested pure builder plus a thin CLI that inserts it.

**Files:**
- Create: `apps/api/src/lib/seed-lead.ts`
- Test: `apps/api/src/lib/seed-lead.test.ts`
- Create: `apps/api/src/scripts/seed-test-lead.ts`

**Interfaces:**
- Produces: `buildSeedLead(input: SeedLeadInput): SeedLeadData` where
  `SeedLeadInput = { orgId: string; firstName: string; lastName: string; linkedinUrl: string; providerLinkedinId: string; company?: string; title?: string }`
  and the returned object has `source: "manual"`, `status: "new"`, `tags: []`, `notes: []`, `enrichmentData: {}`, `company`/`title` defaulting to `""`, and all input fields passed through.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/lib/seed-lead.test.ts
import { describe, expect, it } from "vitest";
import { buildSeedLead } from "./seed-lead.js";

describe("buildSeedLead", () => {
  it("sets provider id and import defaults", () => {
    const data = buildSeedLead({
      orgId: "org1",
      firstName: "Test",
      lastName: "Recipient",
      linkedinUrl: "https://linkedin.com/in/test-recipient",
      providerLinkedinId: "PROV-123",
    });
    expect(data).toMatchObject({
      orgId: "org1",
      source: "manual",
      status: "new",
      firstName: "Test",
      lastName: "Recipient",
      linkedinUrl: "https://linkedin.com/in/test-recipient",
      providerLinkedinId: "PROV-123",
      company: "",
      title: "",
      tags: [],
      notes: [],
      enrichmentData: {},
    });
  });

  it("passes through company and title when provided", () => {
    const data = buildSeedLead({
      orgId: "org1",
      firstName: "T",
      lastName: "R",
      linkedinUrl: "u",
      providerLinkedinId: "p",
      company: "Acme",
      title: "VP",
    });
    expect(data.company).toBe("Acme");
    expect(data.title).toBe("VP");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @leadreacher/api test src/lib/seed-lead.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builder**

```ts
// apps/api/src/lib/seed-lead.ts
export type SeedLeadInput = {
  orgId: string;
  firstName: string;
  lastName: string;
  linkedinUrl: string;
  providerLinkedinId: string;
  company?: string;
  title?: string;
};

export type SeedLeadData = {
  orgId: string;
  source: "manual";
  status: "new";
  firstName: string;
  lastName: string;
  linkedinUrl: string;
  providerLinkedinId: string;
  company: string;
  title: string;
  tags: string[];
  notes: string[];
  enrichmentData: Record<string, never>;
};

export function buildSeedLead(input: SeedLeadInput): SeedLeadData {
  return {
    orgId: input.orgId,
    source: "manual",
    status: "new",
    firstName: input.firstName,
    lastName: input.lastName,
    linkedinUrl: input.linkedinUrl,
    providerLinkedinId: input.providerLinkedinId,
    company: input.company ?? "",
    title: input.title ?? "",
    tags: [],
    notes: [],
    enrichmentData: {},
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @leadreacher/api test src/lib/seed-lead.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the CLI script**

```ts
// apps/api/src/scripts/seed-test-lead.ts
/**
 * Seed a single recipient lead for the live E2E test, WITH providerLinkedinId.
 *
 * Usage:
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/seed-test-lead.ts \
 *     --org <orgId> --provider <providerLinkedinId> --url <linkedinUrl> \
 *     --first <firstName> --last <lastName> [--company <c>] [--title <t>]
 */
import { buildSeedLead, type SeedLeadInput } from "../lib/seed-lead.js";
import { prisma } from "../lib/prisma.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function requireArg(name: string): string {
  const value = arg(name);
  if (!value) {
    console.error(`✗ Missing required arg: --${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const input: SeedLeadInput = {
    orgId: requireArg("org"),
    providerLinkedinId: requireArg("provider"),
    linkedinUrl: requireArg("url"),
    firstName: requireArg("first"),
    lastName: requireArg("last"),
    company: arg("company"),
    title: arg("title"),
  };

  const created = await prisma.lead.create({ data: buildSeedLead(input) });
  console.log(`✓ Seeded lead ${created.id} (provider_id ${input.providerLinkedinId})`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error("✗", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @leadreacher/api lint`
Expected: clean.

```bash
git add apps/api/src/lib/seed-lead.ts apps/api/src/lib/seed-lead.test.ts apps/api/src/scripts/seed-test-lead.ts
git commit -m "feat(api): add recipient lead seeding script for live E2E"
```

---

### Task 3: Write the live-E2E runbook

The runbook is the operational deliverable: exact, copy-pasteable commands and a per-step verification table. All endpoints below are confirmed against the source.

**Files:**
- Create: `apps/api/docs/pipeline-live-e2e-runbook.md`

- [ ] **Step 1: Create the runbook** with these sections and exact content:

````markdown
# Live E2E Pipeline Runbook

## 0. Prerequisites
1. `cd apps/api && pnpm dev` (or `pnpm dev:api` from root) — API + in-process worker up on :3001.
2. Sender health: `pnpm --filter @leadreacher/api exec tsx src/scripts/test-unipile.ts` → T1–T3 PASS. Record the sender `account_id`.
3. Tunnel: `ngrok http 3001` → copy the https URL. In `apps/api/.env` set `UNIPILE_WEBHOOK_URL=https://<tunnel>/webhooks/unipile`.
4. Register webhooks: `pnpm --filter @leadreacher/api exec tsx src/scripts/recreate-unipile-webhooks.ts` → confirm 2 webhooks in the Unipile dashboard.
5. Token: `TOKEN=$(pnpm -s --filter @leadreacher/api exec tsx src/scripts/get-test-token.ts <email> <password> 2>/dev/null)`
6. Create the SocialAccount row: `curl -sX POST localhost:3001/social-accounts/sync -H "Authorization: Bearer $TOKEN"` → confirm a `linkedin` account with `status: active`.
7. Get the org id: `pnpm --filter @leadreacher/api exec tsx -e "import('./src/lib/prisma.js').then(async ({prisma})=>{console.log((await prisma.organization.findFirst())?.id); process.exit(0)})"`

## 1. Track A — ingestion (no outreach)
```bash
curl -sX POST localhost:3001/leads/scrape -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"filters":{"jobTitles":["Software Engineer"],"industries":[],"companySizes":[],"locations":["United States"]},"maxResults":2}'
```
Verify: response `{imported,skipped,total}`; `GET /leads?source=apify` shows the rows with names/title/company/providerLinkedinId. Re-run the same scrape → `skipped` increases, no new rows. **Do not enroll these.**

## 2. Track B — outreach loop (recipient you control)
```bash
# a. Recipient provider_id (note the provider_id printed by T3):
pnpm --filter @leadreacher/api exec tsx src/scripts/test-unipile.ts <SENDER_ACCOUNT_ID> <RECIPIENT_SLUG>

# b. Seed the recipient lead:
pnpm --filter @leadreacher/api exec tsx src/scripts/seed-test-lead.ts \
  --org <ORG_ID> --provider <RECIPIENT_PROVIDER_ID> --url https://linkedin.com/in/<RECIPIENT_SLUG> \
  --first <First> --last <Last>          # -> prints <LEAD_ID>

# c. Create the campaign:
curl -sX POST localhost:3001/campaigns -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"E2E Test","channels":["linkedin"],"sequence":[
    {"type":"connection","message":"Hi, testing connection.","delayHours":0},
    {"type":"message","message":"Thanks for connecting — test DM.","delayHours":0},
    {"type":"message","message":"Test follow-up.","delayHours":24}]}'   # -> <CAMPAIGN_ID>

# d. Enroll + launch:
curl -sX POST localhost:3001/campaigns/<CAMPAIGN_ID>/leads -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"leadIds":["<LEAD_ID>"]}'
curl -sX POST localhost:3001/campaigns/<CAMPAIGN_ID>/launch -H "Authorization: Bearer $TOKEN"
```
Then: watch the API logs; **accept** the invite on the recipient account; after the DM arrives, **reply** on the recipient account.

## 3. Observability checkpoints
| Action | Expected log event | Expected DB state |
|---|---|---|
| launch | `campaign-sequence-step0` `path: invite-sent` | `Lead.status=contacted`; `CampaignLead.currentStep=1`; `Message` step 0 `sent` |
| accept (recipient) | webhook `new_relation` | `Lead.status=connected`; `CampaignLead.linkedinChatId` set, `currentStep=2`; `Message` step 1 `sent` |
| reply (recipient) | webhook `message_received` | `Lead/CampaignLead.status=replied`; inbound `Message`; step-2 job removed (never fires) |

## 4. Findings
(One row per edge case observed during the run: symptom, evidence — log line / DB row, severity.)
- providerLinkedinId gap (pre-identified): …
````

- [ ] **Step 2: Commit**

```bash
git add apps/api/docs/pipeline-live-e2e-runbook.md
git commit -m "docs(api): add live E2E pipeline runbook"
```

---

### Task 4: Execute the live run (GATED — human, not autonomous)

**Do not perform without explicit go-ahead and the burner recipient ready.** This sends real LinkedIn invites/messages.

- [ ] **Step 1:** Complete runbook §0 prerequisites; confirm every check is green.
- [ ] **Step 2:** Run Track A (§1); confirm ingestion + dedup; record results.
- [ ] **Step 3:** Confirm the recipient is **not** already 1st-degree with the sender.
- [ ] **Step 4:** Run Track B (§2) through launch; verify the §3 `invite-sent` checkpoint.
- [ ] **Step 5:** Accept on the recipient; verify the `new_relation` checkpoint and DM delivery.
- [ ] **Step 6:** Reply on the recipient; verify the `message_received` checkpoint and that the step-2 job was cancelled.
- [ ] **Step 7:** Fill in the runbook §4 Findings with evidence; commit:

```bash
git add apps/api/docs/pipeline-live-e2e-runbook.md
git commit -m "docs(api): record live E2E run findings"
```

---

## Self-Review

- **Spec coverage:** prereqs incl. SocialAccount via `/social-accounts/sync` (Task 3 §0) ✓; Track A ingestion + dedup (Task 3 §1, Task 4 §2) ✓; Track B seed-with-provider-id + invite/accept/reply (Tasks 2–4) ✓; configurable webhook URL (Task 1) ✓; observability table (Task 3 §3) ✓; failure modes / findings (Task 3 §4, Task 4 §7) ✓; providerLinkedinId bug documented, not fixed ✓.
- **Placeholders:** code tasks contain full code; `<UPPERCASE>` tokens in the runbook are intentional user-supplied run values, not plan gaps.
- **Type consistency:** `resolveWebhookUrl(env)` and `buildSeedLead(input)` signatures match their tests and call sites; runbook endpoints (`POST /campaigns`, `POST /campaigns/:id/leads {leadIds}`, `POST /campaigns/:id/launch`, `POST /social-accounts/sync`, `POST /leads/scrape`) match `routes/`.
- **Endpoint note for executor:** the org-id helper in §0.7 assumes a single test org; if multiple exist, pass the correct id explicitly.
