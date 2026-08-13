# Authentication Hardening

LeadReacher uses Supabase Auth with SSR cookie storage. The browser reads the
current access token only because it must send that token to the separate API
service. Do not move sessions into `localStorage`.

## Development

Use a dedicated development Supabase project. In that project:

- Keep **Confirm email** disabled so local signup creates a session immediately.
- CAPTCHA may remain disabled; leave `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset.
- Restrict redirect URLs to local development addresses, for example
  `http://localhost:3000/**` and the actual local port in use.

Never use production Supabase credentials or CAPTCHA keys locally.

## Production Supabase configuration

Set these values in **Supabase Dashboard -> Authentication** before releasing:

| Area | Required production setting |
| --- | --- |
| Email sign-in | Enable **Confirm email**. |
| Password security | Minimum length: `12`; require upper/lowercase, number, and symbol; enable leaked-password protection. |
| CAPTCHA | Enable CAPTCHA for signup, password sign-in, and password recovery. Configure the Turnstile secret in Supabase and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in the web deployment. |
| Redirect URLs | Allow only the deployed LeadReacher domains and `/auth/callback`, `/reset-password`; remove wildcard or temporary preview domains that are no longer needed. |
| Rate limits | Set explicit limits for password sign-in, signup, password recovery, OTP, and token refresh according to the production email provider capacity. |

The application displays generic errors for failed sign-in, recovery, CAPTCHA,
and rate-limited requests so it does not disclose whether an email exists.

## Multi-factor authentication

Users enroll a TOTP authenticator in **Settings -> Security**. A verified MFA
factor upgrades the session to `aal2` after an authenticator-code challenge.
The API requires `aal2` and an organization owner for:

- Stripe checkout and billing portal sessions
- organization data-export creation, listing, and download
- organization deletion and recovery
- connecting or confirming a social account after workspace onboarding

New workspaces may connect the initial sender before MFA is enrolled so the
onboarding flow remains usable. Once onboarding is complete, account connection
requires MFA.

There are not yet self-service recovery codes. Before requiring MFA for every
user, establish a documented support process that verifies organization
ownership and securely assists users who lose their authenticator device.

## Browser protections

`apps/web/src/proxy.ts` issues a per-request nonce and applies CSP, frame,
referrer, MIME-sniffing, permissions, opener, and production HSTS headers.
When adding a third-party script or host, update
`apps/web/src/lib/security/headers.ts` intentionally and keep the source as
narrow as possible.

## Verification checklist

1. In development, create an account and confirm the dashboard opens without
   an email confirmation step.
2. In staging, enable production-equivalent confirmation and CAPTCHA, then
   test signup, sign-in, password recovery, OAuth, and a rate-limited retry.
3. Enroll TOTP and confirm that a fresh password login lands on `/verify-mfa`.
4. Verify an `aal1` token receives `MFA_REQUIRED` from billing, export,
   deletion, recovery, and established-workspace social-connect routes.
5. Verify an `aal2` owner can complete those actions and a non-owner cannot.
