import { redis } from "./redis.js";

const DAILY_SEND_CAPS = {
  invite: 20,
  message: 50,
} as const;

export type DailySendKind = keyof typeof DAILY_SEND_CAPS;

export function utcDay(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

export function dailySendLimitKey(
  unipileId: string,
  kind: DailySendKind,
  date = new Date(),
): string {
  return `rate-limit:${kind}:${unipileId}:${utcDay(date)}`;
}

export function millisecondsUntilNextUtcDay(now = new Date()): number {
  const nextDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, nextDay - now.getTime());
}

export async function checkAndIncrementDailySendLimit(
  unipileId: string,
  kind: DailySendKind,
): Promise<{ allowed: boolean; remaining: number }> {
  const cap = DAILY_SEND_CAPS[kind];
  const key = dailySendLimitKey(unipileId, kind);
  const count = await redis.incr(key);

  if (count === 1) {
    // The date is in the key. The small buffer only cleans up yesterday's key
    // after rollover; it never allows a new date to share the prior counter.
    await redis.expire(
      key,
      Math.ceil(millisecondsUntilNextUtcDay() / 1000) + 60 * 60,
    );
  }

  if (count > cap) {
    await redis.decr(key);
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: cap - count };
}
