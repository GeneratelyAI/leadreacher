# Live E2E Pipeline Runbook

## 0. Prerequisites
0. Generate the Prisma client (required after a fresh checkout/install, else `prisma.<model>` is undefined): `pnpm --filter @leadreacher/api exec prisma generate`.
1. `cd apps/api && pnpm dev` (or `pnpm dev:api` from root) — API + in-process worker up on :3001.
2. Sender health: `pnpm --filter @leadreacher/api exec tsx src/scripts/test-unipile.ts` → T1–T3 PASS (read-only by default). Record the sender `account_id`. ⚠️ Do NOT add `--send` here — that flag fires a real connection invite + DM (T4/T5) at the target slug. The plain run sends nothing.
3. Tunnel: `ngrok http 3001` → copy the https URL. In `apps/api/.env` set `UNIPILE_WEBHOOK_URL=https://<tunnel>/webhooks/unipile`.
4. Register webhooks: `pnpm --filter @leadreacher/api exec tsx src/scripts/recreate-unipile-webhooks.ts` → confirm 2 webhooks in the Unipile dashboard.
5. Token: `TOKEN=$(pnpm -s --filter @leadreacher/api exec tsx src/scripts/get-test-token.ts <email> <password> 2>/dev/null)`
6. Create the SocialAccount row: `curl -sX POST localhost:3001/social-accounts/sync -H "Authorization: Bearer $TOKEN"` → confirm a `linkedin` account with `status: active`.
7. Get the org id: `pnpm --filter @leadreacher/api exec tsx -e "import('./src/lib/prisma.js').then(async ({prisma})=>{console.log((await prisma.organization.findFirst())?.id); process.exit(0)})"`

## 1. Track A — ingestion (no outreach)
Run a small scrape and verify ingestion + dedup, then STOP — do not enroll these leads.

```bash
curl -sX POST localhost:3001/leads/scrape -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"filters":{"jobTitles":["Software Engineer"],"industries":[],"companySizes":[],"locations":["United States"]},"maxResults":2}'
```

Verify: response `{imported,skipped,total}`; `GET /leads?source=apify` shows the rows with names/title/company/providerLinkedinId. Re-run the same scrape → `skipped` increases, no new rows. **Do not enroll these scraped strangers.**

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
- providerLinkedinId gap (pre-identified): leads without `providerLinkedinId` cannot be matched by the `new_relation` webhook and the invite is sent with an empty `provider_id`. Worked around here by seeding with a real provider_id.
