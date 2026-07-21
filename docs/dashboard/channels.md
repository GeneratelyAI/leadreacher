# Channels

## Function

Channels manages the account and health state used for outreach.

## Current implementation

`/home?view=channels` lists persisted accounts, syncs account status from
Unipile, and starts LinkedIn hosted authorization. A hosted-auth return lands
back on the Channels view. Connecting an account does not create or send a
campaign.

## Required capabilities

- List connected accounts by platform and account name.
- Reconnect failed accounts through hosted authentication.
- Explain which campaigns depend on a disconnected account.
- Add new supported channels without treating unavailable channels as active.

## System-design notes

LeadReacher stores Unipile account references, not provider passwords or session
cookies. See [credential storage](../architecture/security-credential-storage.md)
for the custody model and [connection testing](../operations/unipile-connection-testing.md)
for a safe verification procedure.
