/**
 * Normalize phone numbers toward E.164-ish digits (leading + optional).
 * Returns null when the value cannot be used for WhatsApp outreach.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;

  return hasPlus || digits.length > 10 ? `+${digits}` : `+${digits}`;
}

export function phoneDigits(raw: string | null | undefined): string | null {
  const normalized = normalizePhoneE164(raw);
  if (!normalized) return null;
  return normalized.replace(/\D/g, "");
}
