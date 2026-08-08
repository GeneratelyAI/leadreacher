import { cleanWebsiteDomain } from "@/lib/website-url";

export const LANDING_ANALYSIS_STEPS = [
  "Reading website",
  "Understanding business",
  "Finding audience",
  "Building strategy",
] as const;

export function normalizeLandingWebsiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed))) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!url.hostname.includes(".") || url.username || url.password) return null;
    return cleanWebsiteDomain(url.toString()) || null;
  } catch {
    return null;
  }
}

export function analysisStepForElapsedTime(elapsedMs: number): number {
  if (elapsedMs < 700) return 0;
  if (elapsedMs < 1_400) return 1;
  if (elapsedMs < 2_300) return 2;
  return 3;
}
