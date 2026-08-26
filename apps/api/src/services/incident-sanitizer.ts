const SECRET_PATTERNS = [
  /\b(?:bearer|basic)\s+[a-z0-9._~+\/-]+=*/gi,
  /\b(?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi,
  /\bgh[pousr]_[a-z0-9]{20,}\b/gi,
  /\bsk-[a-z0-9_-]{16,}\b/gi,
] as const;

export function sanitizeIncidentText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  let result = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ");
  for (const pattern of SECRET_PATTERNS) result = result.replace(pattern, "[REDACTED]");
  result = result
    .replace(/([?&](?:token|key|secret|signature|auth)=)[^&#\s]+/gi, "$1[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]")
    .replace(/\s+/g, " ")
    .trim();
  return result.slice(0, maxLength);
}

export function sanitizeProviderUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2_000) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

export function sanitizeIdentifier(value: unknown, fallback: string): string {
  const result = sanitizeIncidentText(value, 160).replace(/[^a-zA-Z0-9._:-]/g, "-");
  return result || fallback;
}

