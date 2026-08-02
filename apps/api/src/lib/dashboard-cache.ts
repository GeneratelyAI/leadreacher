import { redis } from "./redis.js";

const DASHBOARD_CHROME_TTL_SECONDS = 30;

export function dashboardChromeCacheKey(orgId: string): string {
  return `dashboard:chrome:v1:${orgId}`;
}

export async function readDashboardChrome<T>(orgId: string): Promise<T | null> {
  try {
    const cached = await redis.get(dashboardChromeCacheKey(orgId));
    return cached ? (JSON.parse(cached) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheDashboardChrome(orgId: string, value: unknown): Promise<void> {
  try {
    await redis.set(
      dashboardChromeCacheKey(orgId),
      JSON.stringify(value),
      "EX",
      DASHBOARD_CHROME_TTL_SECONDS,
    );
  } catch {
    // The dashboard remains available when Redis is temporarily unavailable.
  }
}

export async function invalidateDashboardChrome(orgId: string): Promise<void> {
  try {
    await redis.del(dashboardChromeCacheKey(orgId));
  } catch {
    // Cache invalidation must not turn a successful operational mutation into a failure.
  }
}
