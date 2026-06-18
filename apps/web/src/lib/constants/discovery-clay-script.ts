/**
 * Clay demo script for /onboarding/discovery.
 *
 * Usage:
 *   pnpm --filter @leadreacher/web discovery:clay
 *   → opens http://localhost:3000/onboarding/discovery?test=clay
 *
 * Or visit manually with ?test=clay while logged in.
 * Answers auto-submit after the intro transition finishes.
 */

export const CLAY_DISCOVERY_TEST_QUERY = "test=clay";

export const CLAY_DISCOVERY_ANSWERS = [
  "Clay — we build a data enrichment and workflow automation platform that pulls from 100+ data sources to help sales teams build hyper-targeted lead lists",
  "We have the largest enrichment waterfall in the market — 100+ data providers in one place, so you never have to stitch tools together manually",
  "Sales ops, revenue operations leads, and growth engineers at B2B SaaS companies, 50-5000 employees, mainly North America and Europe",
  "Help sales teams spend less time on manual research and more time actually selling",
  "clay.com",
] as const;

export const CLAY_DISCOVERY_AUTORUN = {
  /** After intro ends, wait for first question typing animation */
  initialDelayMs: 2_200,
  /** Pause between answers (AI reply + pill reveal) */
  betweenAnswersMs: 2_800,
} as const;

export function isClayDiscoveryTestMode(search: string): boolean {
  return new URLSearchParams(search).get("test") === "clay";
}

export function getClayDiscoveryTestPath(): string {
  return `/onboarding/discovery?${CLAY_DISCOVERY_TEST_QUERY}`;
}

export function getClayDiscoveryTestUrl(
  origin = "http://localhost:3000",
): string {
  return `${origin}${getClayDiscoveryTestPath()}`;
}
