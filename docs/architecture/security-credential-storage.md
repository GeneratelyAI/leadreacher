# Credential Storage Audit

## Scope

Reviewed `apps/api/prisma/schema.prisma`, `apps/api/src/adapters/unipile.ts`, and
`apps/api/src/adapters/types.ts`.

## Social accounts

`SocialAccount` stores account references and display state only:

- `unipileId`: Unipile's account identifier.
- `platformUserId`: the provider account identifier.
- `platform`, `accountName`, `avatarUrl`, `status`, and optional metadata.

It does not contain a LinkedIn password, session cookie, OAuth access token, or
other third-party secret.

## Unipile custody model

LeadReacher starts the provider connection through Unipile hosted auth. The
Unipile adapter receives LeadReacher's service-level DSN and API key from the
environment, then refers to connected end-user accounts by their Unipile IDs.
LinkedIn credentials remain with Unipile; LeadReacher does not receive or persist
them.

## Secrets held by LeadReacher

The active application uses environment-configured credentials for its own
services, including Unipile, Supabase, Upstash Redis, Apify, Firecrawl, Groq,
Google AI/TTS, Cloudflare R2, Stripe, Sentry, and Better Stack. These values must
remain in deployment secret stores and outside source control.

The Prisma `Integration` model has an `encryptedCredentials` field explicitly
documented as AES-256-GCM encrypted. It is reserved for encrypted integration
credentials; no active application code reads or writes it. No plaintext
third-party credential storage was found in the reviewed database model or
Unipile integration code.

## Conclusion

AES-256-GCM implementation for future `Integration` records should remain a
required prerequisite before LeadReacher stores any customer-owned provider
credential. It can be deferred for the current Unipile hosted-auth flow because
customer credentials are not stored by LeadReacher today.
