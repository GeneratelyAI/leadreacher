/**
 * Resolve the LinkedIn provider_id to use for an outreach action.
 *
 * Prefers the lead's stored `providerLinkedinId`; falls back to the id fetched
 * from the live profile. Empty/whitespace values are treated as missing.
 * Returns `null` when no usable id exists — callers MUST guard against null
 * rather than sending an action with an empty provider_id.
 */
export function resolveProviderId(
  leadProviderId: string | null | undefined,
  profileProviderId: string | null | undefined,
): string | null {
  const lead = leadProviderId?.trim();
  if (lead) {
    return lead;
  }
  const profile = profileProviderId?.trim();
  return profile ? profile : null;
}
