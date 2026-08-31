# Testing the Unipile v2 connection

This runbook verifies that LeadReacher can authenticate to Unipile v2, read a
connected account, and fetch a real provider profile without sending anything.

## Prerequisites

| Requirement | Notes |
| --- | --- |
| Unipile v2 application | Use the matching development or production application. |
| v2 API key | Use a Service API key for the backend so the same key can manage accounts, Hosted Auth, webhooks, and account-scoped calls. |
| Connected account | Its status must be `running`. |
| Node 20+ and pnpm 9+ | Repository prerequisites. |

Unipile v2 uses the fixed API origin `https://api.unipile.com/v2`. A DSN is not
used or supported by LeadReacher.

## Environment

Add the secret to `apps/api/.env` or the deployed backend environment:

```dotenv
UNIPILE_API_KEY=your_v2_service_api_key
```

Webhook delivery also requires `UNIPILE_WEBHOOK_SECRET`, which is the endpoint
secret returned when the v2 webhook endpoint is created. Keep both values on
the backend only.

## Read-only smoke test

Run from the repository root:

```bash
pnpm --filter @leadreacher/api exec tsx src/scripts/test-unipile.ts
```

Optionally target an account and public profile slug:

```bash
pnpm --filter @leadreacher/api exec tsx src/scripts/test-unipile.ts <accountId> <publicId>
```

The test performs three read-only checks:

1. `GET /v2/accounts/` lists the connected accounts.
2. `GET /v2/accounts/{account_id}` reports the selected account as `running`.
3. `GET /v2/{account_id}/users/{public_id}` returns a provider profile.

The pass condition is `Result: 3/3 passed`.

## Optional delivery check

The `--send` flag enables a real provider action. Use it only with a dedicated
test account and a consenting recipient:

```bash
pnpm --filter @leadreacher/api exec tsx src/scripts/test-unipile.ts <accountId> <publicId> --send
```

Routine operational checks must remain read-only.

## Webhook setup

Use the v2 Service API key and the production webhook URL:

```bash
UNIPILE_WEBHOOK_URL='https://api.leadreacher.ai/webhooks/unipile' \
pnpm --filter @leadreacher/api recreate-unipile-webhooks
```

Store the returned endpoint secret as `UNIPILE_WEBHOOK_SECRET` for every API
instance that receives Unipile callbacks. Subscribe to `message.new`,
`email.new`, `relation.new`, and the supported account status events.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `401 Unauthorized` | The key is invalid, expired, or belongs to v1. |
| `403 Forbidden` on webhook endpoints | An Account key was used. Webhook administration requires a Service API key. |
| Empty account list | Accounts were not transferred or linked to this v2 application. |
| Account is not `running` | Reauthenticate the provider account in the v2 dashboard. |
| Webhook signature rejected | The deployed endpoint secret does not match `UNIPILE_WEBHOOK_SECRET`, or the timestamp is stale. |

## Cutover checklist

- [ ] All required accounts exist in v2 and report `running`.
- [ ] Database account IDs use the v2 `acc_` identifiers.
- [ ] `UNIPILE_API_KEY` is the v2 Service API key in API and worker services.
- [ ] `UNIPILE_DSN` is deleted from every environment.
- [ ] The v2 webhook endpoint targets `/webhooks/unipile`.
- [ ] `UNIPILE_WEBHOOK_SECRET` matches the v2 endpoint secret.
- [ ] API and worker deployments are healthy.
- [ ] Read-only smoke tests pass against the deployed configuration.
