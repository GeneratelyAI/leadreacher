# Testing the Unipile ↔ LinkedIn Connection

A smoke-test procedure to verify that a LinkedIn account connected through
[Unipile](https://www.unipile.com/) is reachable from our API.

The test proves three things, in order:

1. **Credentials** — our API key + DSN reach the Unipile API.
2. **Account** — a LinkedIn account is actually connected through Unipile.
3. **Authenticated call** — we can perform a real LinkedIn action on that
   account's behalf.

> Scope: read-only verification. We deliberately stop before any action that
> touches the LinkedIn account (invites, messages). See
> [Out of scope](#out-of-scope).

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

Escalate from cheapest/safest to most meaningful:

### 3a. List connected accounts — `GET /accounts`

The best first call: it validates the API key + DSN **and** returns the
`account_id` + live status in one shot.

- **Pass:** HTTP 200, response lists your LinkedIn account with a healthy status.
- **Note:** the adapter does not expose a `listAccounts()` method yet (it only
  has `getAccountStatus(accountId)`, [`unipile.ts:105`](../src/adapters/unipile.ts)).
  Add a small `listAccounts()` or hit the endpoint directly in the script.

### 3b. Check a specific account — `getAccountStatus(accountId)`

```ts
const adapter = new UnipileAdapter({ dsn, apiKey });
const status = await adapter.getAccountStatus(accountId);
```

- **Pass:** returns `{ id, type, status }` with a healthy `status`.

### 3c. Fetch a real profile — `getProfile(accountId, publicId)`

```ts
const profile = await adapter.getProfile(accountId, "williamhgates");
```

- **Pass:** returns a `UnipileProfile` (`provider_id`, `public_identifier`,
  `first_name`, `last_name`, `headline`). This proves an authenticated LinkedIn
  call works end-to-end.

---

## Pass criteria

- [ ] **3a** — `GET /accounts` returns 200 and lists the LinkedIn account.
- [ ] Account status is `OK` / `CONNECTED`.
- [ ] **3b** — `getAccountStatus` returns a healthy status for the `account_id`.
- [ ] **3c** — `getProfile` returns a populated profile for a known public slug.

All four green ⇒ the Unipile ↔ LinkedIn connection works.

---

## Out of scope

Do **not** run these during a connection test — they take real actions on the
LinkedIn account and/or hit known bugs:

- `sendConnectionInvite` — sends a real connection request, **and** crashes on
  Unipile's empty `200/204` response because `request()` unconditionally calls
  `res.json()` ([`unipile.ts:52`](../src/adapters/unipile.ts)).
- `startChat` / `sendMessageToChat` — send real messages.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401 / Unauthorized` | Wrong `UNIPILE_API_KEY`, or key not enabled for this DSN. |
| `fetch failed` / DNS error | `UNIPILE_DSN` missing the port, or wrong host. |
| Empty account list | LinkedIn account not connected, or connected under a different Unipile workspace. |
| Account status `CREDENTIALS` / checkpoint | LinkedIn requires re-auth / 2FA — reconnect in the dashboard. |
| `Invalid environment variables` thrown at startup | You imported `config/env.ts`, which requires DB vars. Use a standalone script (see Step 2). |
| `Unexpected end of JSON input` | An endpoint returned an empty body; only expected if you call a void endpoint like `sendConnectionInvite` (out of scope). |

---

## Known adapter gaps (for follow-up, not this test)

- No account **connect / hosted-auth** flow — connection is manual via dashboard.
- No **credential decryption** path — `Integration.encryptedCredentials` is
  AES-256-GCM per the schema, but nothing decrypts it yet; the test uses raw
  env credentials.
- Responses are **unchecked `as T` casts** — no Zod validation at the boundary.
- No **timeout / retry** on `fetch`.

See the adapter review notes for detail.
