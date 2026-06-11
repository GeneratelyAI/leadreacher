# Testing the Unipile ↔ LinkedIn Connection

A smoke-test procedure to verify that a LinkedIn account connected through
[Unipile](https://www.unipile.com/) is reachable from our API.

The test proves three things, in order:

1. **Credentials** — our API key + DSN reach the Unipile API.
2. **Account** — a LinkedIn account is actually connected through Unipile.
3. **Authenticated call** — we can perform a real LinkedIn action on that
   account's behalf.

> Scope: read-only verification — the test only calls read endpoints and never
> takes an action on the LinkedIn account (no invites or messages).

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Unipile dashboard access | To obtain the API key + DSN and connect an account. |
| Unipile **DSN** | Host **and** port, e.g. `apiXXX.unipile.com:13XXX`. The adapter builds `https://${dsn}/api/v1` ([`unipile.ts:26`](../src/adapters/unipile.ts)). |
| Unipile **API key** | From the dashboard (Settings → API). |
| A LinkedIn account | Use a **test/burner account**, not a critical one — LinkedIn automation carries ban risk. |
| Node 20+, pnpm 9+ | Repo prerequisites. |

---

## Step 1 — Connect the LinkedIn account to Unipile

> The adapter has **no connect/hosted-auth method yet** — it only operates on an
> account that is already connected. So connect the account outside the code.

1. Unipile dashboard → **Add account** → **LinkedIn**.
2. Complete the login wizard (handle 2FA / security checkpoint if prompted).
3. On success, Unipile assigns an **`account_id`** (a string). **Record it** —
   every adapter method is keyed off this `account_id`.
4. Confirm the account status is `OK` / `CONNECTED` (not `CREDENTIALS` or a
   checkpoint state).

---

## Step 2 — Configure environment

Add the credentials to `apps/api/.env` (loaded from `process.cwd()/.env`,
see [`config/env.ts:5`](../src/config/env.ts)):

```dotenv
UNIPILE_DSN=apiXXX.unipile.com:13XXX
UNIPILE_API_KEY=your_api_key_here
```

> ⚠️ **Gotcha:** `config/env.ts` also requires `DATABASE_URL`, `DIRECT_URL`, and
> `PORT`, and throws if any are missing. For a Unipile-only test, prefer a
> **standalone script that reads `process.env` directly** rather than importing
> `env.ts`, so a database is not a dependency. (`.env` is git-ignored.)

---

## Step 3 — Run the smoke test

The test is automated in [`src/scripts/test-unipile.ts`](../src/scripts/test-unipile.ts).
It reads `UNIPILE_DSN` / `UNIPILE_API_KEY` from `.env` directly (no DB required)
and runs all three checks in one command:

```bash
# from apps/api
pnpm exec tsx src/scripts/test-unipile.ts

# or from the repo root
pnpm --filter @leadreacher/api exec tsx src/scripts/test-unipile.ts

# optionally target a specific account / public profile slug
pnpm exec tsx src/scripts/test-unipile.ts <accountId> <publicId>
```

By default it uses the **first connected account** and the slug **`williamhgates`**.
The checks escalate from cheapest/safest to most meaningful:

### T1. List connected accounts — `adapter.listAccounts()` → `GET /accounts`

Validates the API key + DSN **and** returns the connected accounts (with
`account_id` + `type`) in one shot.

- **Pass:** HTTP 200 and at least one LinkedIn account is listed.

### T2. Check a specific account — `adapter.getAccountStatus(accountId)`

```ts
const account = await adapter.getAccountStatus(accountId);
// { id, type, name, sources: [{ id, status }] }
```

A LinkedIn account exposes one or more **sources** (e.g. `MESSAGING`), each with
its own `status` — there is **no** top-level `status` field. The script uses the
exported `isAccountHealthy()` helper.

- **Pass:** every source reports `status === "OK"`.

### T3. Fetch a real profile — `adapter.getProfile(accountId, publicId)`

```ts
const profile = await adapter.getProfile(accountId, "williamhgates");
```

- **Pass:** returns a `UnipileProfile` (`provider_id`, `public_identifier`,
  `first_name`, `last_name`, `headline`). This proves an authenticated LinkedIn
  call works end-to-end.

---

## Pass criteria

- [ ] **T1** — `listAccounts()` returns 200 and lists the LinkedIn account.
- [ ] **T2** — every source on the account reports `OK` (`isAccountHealthy` true).
- [ ] **T3** — `getProfile` returns a populated profile for a known public slug.

`Result: 3/3 passed` ⇒ the Unipile ↔ LinkedIn connection works.

---

## Last verified run

- **Date:** 2026-06-10
- **DSN:** `api**.unipile.com:*****` (redacted)
- **Account:** 1 LinkedIn account connected (proxy region: CA), source
  `..._MESSAGING` = `OK`.
- **Result:** **3/3 passed** — T3 fetched a real public profile
  (`williamhgates` → "Bill Gates") through the connected account.

Output (account id, account name, and DSN redacted):

```text
Unipile smoke test → api**.unipile.com:*****

✓ PASS  T1  GET /accounts (credentials + account list)
        1 account(s) connected:
          - <account-id> (LINKEDIN) — <account-name>

  Using account_id: <account-id>

        type: LINKEDIN; sources: <account-id>_MESSAGING=OK
✓ PASS  T2  getAccountStatus(<account-id>)
✓ PASS  T3  getProfile(account, "williamhgates")
        Bill Gates — Chair, Gates Foundation and Founder, Breakthrough Energy

Result: 3/3 passed.
```

> Note on the account used: no shared test account exists yet, so the test was
> run against a **personal LinkedIn account**. Unipile connections are **not**
> sandboxed/read-only — the stored session can read *and* write. Safety here came
> from only invoking read methods, not from a permission scope. A **dedicated
> test account is still needed** for ongoing QA.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401 / Unauthorized` | Wrong `UNIPILE_API_KEY`, or key not enabled for this DSN. |
| `fetch failed` / DNS error | `UNIPILE_DSN` missing the port, or wrong host. |
| Empty account list | LinkedIn account not connected, or connected under a different Unipile workspace. |
| Account status `CREDENTIALS` / checkpoint | LinkedIn requires re-auth / 2FA — reconnect in the dashboard. |
| `Invalid environment variables` thrown at startup | You imported `config/env.ts`, which requires DB vars. Use a standalone script (see Step 2). |
| `Unexpected end of JSON input` | An endpoint returned an empty body. The three read calls (T1–T3) always return JSON, so this should not occur during this test. |

---

## Known adapter gaps (for follow-up, not this test)

- No account **connect / hosted-auth** flow — connection is manual via dashboard.
- No **credential decryption** path — `Integration.encryptedCredentials` is
  AES-256-GCM per the schema, but nothing decrypts it yet; the test uses raw
  env credentials.
- Responses are **unchecked `as T` casts** — no Zod validation at the boundary.
- No **timeout / retry** on `fetch`.
- `sendConnectionInvite` **crashes on empty `200/204` bodies** — `request()`
  always calls `res.json()` ([`unipile.ts:52`](../src/adapters/unipile.ts)).

**Fixed during this work:** `getAccountStatus` now reads status from `sources[]`
instead of a non-existent top-level `status` field, and `listAccounts()` was
added.

See the adapter review notes for detail.
