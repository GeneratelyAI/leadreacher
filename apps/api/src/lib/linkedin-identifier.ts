/**
 * Resolve the identifier used to look up a lead on LinkedIn: the stored
 * provider id when present, otherwise the public slug parsed from the profile
 * URL. Returns null when neither is usable.
 */
export function leadLinkedinIdentifier(lead: {
  providerLinkedinId: string | null;
  linkedinUrl: string | null;
}): string | null {
  const providerLinkedinId = lead.providerLinkedinId?.trim();
  if (providerLinkedinId) {
    return providerLinkedinId;
  }
  if (!lead.linkedinUrl) {
    return null;
  }
  const match = lead.linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1] ?? null;
}
