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

export type DailySendLimitStatus = {
  limit: number;
  remaining: number;
  resetAt: string;
};

export async function getDailySendLimitStatus(
  unipileId: string,
  kind: DailySendKind,
  now = new Date(),
): Promise<DailySendLimitStatus> {
  const limit = DAILY_SEND_CAPS[kind];
  const rawCount = await redis.get(dailySendLimitKey(unipileId, kind, now));
  const count = Number.parseInt(rawCount ?? "0", 10);

  return {
    limit,
    remaining: Math.max(0, limit - (Number.isFinite(count) ? count : 0)),
    resetAt: new Date(now.getTime() + millisecondsUntilNextUtcDay(now)).toISOString(),
  };
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

const INSTAGRAM_MATURE_DAILY_AUTOMATION_CAP = 100;
const INSTAGRAM_HOURLY_AUTOMATION_CAP = 10;

function instagramDailyCap(connectedAt?: Date): number {
  if (!connectedAt) return INSTAGRAM_MATURE_DAILY_AUTOMATION_CAP;
  const ageDays = Math.floor((Date.now() - connectedAt.getTime()) / 86_400_000);
  if (ageDays < 7) return 5;
  if (ageDays < 14) return 10;
  return INSTAGRAM_MATURE_DAILY_AUTOMATION_CAP;
}

export type ChannelAutomationStatus = {
  stage: "new" | "warming" | "mature";
  dailyLimit: number;
  dailyRemaining: number;
  hourlyLimit: number;
  hourlyRemaining: number;
  pacingRemainingMs: number;
  resetAt: string;
};

function accountStage(connectedAt?: Date): ChannelAutomationStatus["stage"] {
  if (!connectedAt) return "mature";
  const ageDays = Math.floor((Date.now() - connectedAt.getTime()) / 86_400_000);
  if (ageDays < 7) return "new";
  if (ageDays < 14) return "warming";
  return "mature";
}

export async function getInstagramAutomationStatus(input: {
  unipileId: string;
  connectedAt?: Date;
}): Promise<ChannelAutomationStatus> {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const dailyLimit = instagramDailyCap(input.connectedAt);
  const [dailyRaw, hourlyRaw, paceTtl] = await Promise.all([
    redis.get(`rate-limit:instagram-automation:day:${input.unipileId}:${utcDay(now)}`),
    redis.get(`rate-limit:instagram-automation:hour:${input.unipileId}:${hour}`),
    redis.pttl(`rate-limit:instagram-automation:pace:${input.unipileId}`),
  ]);
  const daily = Number.parseInt(dailyRaw ?? "0", 10) || 0;
  const hourly = Number.parseInt(hourlyRaw ?? "0", 10) || 0;
  return {
    stage: accountStage(input.connectedAt),
    dailyLimit,
    dailyRemaining: Math.max(0, dailyLimit - daily),
    hourlyLimit: INSTAGRAM_HOURLY_AUTOMATION_CAP,
    hourlyRemaining: Math.max(0, INSTAGRAM_HOURLY_AUTOMATION_CAP - hourly),
    pacingRemainingMs: Math.max(0, paceTtl),
    resetAt: new Date(now.getTime() + millisecondsUntilNextUtcDay(now)).toISOString(),
  };
}

export async function checkInstagramAutomatedMessageLimit(input: {
  unipileId: string;
  connectedAt?: Date;
}): Promise<{ allowed: boolean; retryAfterMs: number; remaining: number }> {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const dailyKey = `rate-limit:instagram-automation:day:${input.unipileId}:${utcDay(now)}`;
  const hourlyKey = `rate-limit:instagram-automation:hour:${input.unipileId}:${hour}`;
  const pacingKey = `rate-limit:instagram-automation:pace:${input.unipileId}`;
  const paceMs = 2 * 60_000 + Math.floor(Math.random() * 2 * 60_000);
  const dailyCap = instagramDailyCap(input.connectedAt);
  const dailyTtlSeconds = Math.ceil(millisecondsUntilNextUtcDay(now) / 1000) + 3600;
  const result = await redis.eval(
    `
      local paceTtl = redis.call("PTTL", KEYS[3])
      if paceTtl > 0 then return {0, paceTtl, 0} end

      local hourlyCount = tonumber(redis.call("GET", KEYS[2]) or "0")
      if hourlyCount >= tonumber(ARGV[2]) then return {0, tonumber(ARGV[5]), 0} end

      local dailyCount = tonumber(redis.call("GET", KEYS[1]) or "0")
      if dailyCount >= tonumber(ARGV[1]) then return {0, tonumber(ARGV[6]), 0} end

      dailyCount = redis.call("INCR", KEYS[1])
      if dailyCount == 1 then redis.call("EXPIRE", KEYS[1], ARGV[3]) end
      hourlyCount = redis.call("INCR", KEYS[2])
      if hourlyCount == 1 then redis.call("EXPIRE", KEYS[2], ARGV[4]) end
      redis.call("SET", KEYS[3], "1", "PX", ARGV[5])
      return {1, 0, tonumber(ARGV[1]) - dailyCount}
    `,
    3,
    dailyKey,
    hourlyKey,
    pacingKey,
    dailyCap,
    INSTAGRAM_HOURLY_AUTOMATION_CAP,
    dailyTtlSeconds,
    2 * 60 * 60,
    paceMs,
    millisecondsUntilNextUtcDay(now),
  );
  if (!Array.isArray(result) || result.length < 3) {
    throw new Error("Instagram rate limiter returned an invalid response");
  }
  const [allowed, retryAfterMs, remaining] = result.map(Number);
  return {
    allowed: allowed === 1,
    retryAfterMs: Math.max(0, retryAfterMs),
    remaining: Math.max(0, remaining),
  };
}

function whatsappNewChatDailyCap(connectedAt?: Date): number {
  if (!connectedAt) return 30;
  const ageDays = Math.floor((Date.now() - connectedAt.getTime()) / 86_400_000);
  if (ageDays < 7) return 3;
  if (ageDays < 14) return 10;
  return 30;
}

export async function checkWhatsAppAutomatedMessageLimit(input: {
  unipileId: string;
  connectedAt?: Date;
  isNewChat: boolean;
}): Promise<{ allowed: boolean; retryAfterMs: number; remaining: number }> {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const keys = [
    `rate-limit:whatsapp-automation:day:${input.unipileId}:${utcDay(now)}`,
    `rate-limit:whatsapp-automation:hour:${input.unipileId}:${hour}`,
    `rate-limit:whatsapp-automation:pace:${input.unipileId}`,
    `rate-limit:whatsapp-new-chat:day:${input.unipileId}:${utcDay(now)}`,
  ];
  const paceMs = 10_000 + Math.floor(Math.random() * 10_000);
  const dailyTtl = Math.ceil(millisecondsUntilNextUtcDay(now) / 1000) + 3600;
  const result = await redis.eval(
    `
      local paceTtl = redis.call("PTTL", KEYS[3])
      if paceTtl > 0 then return {0, paceTtl, 0} end
      local daily = tonumber(redis.call("GET", KEYS[1]) or "0")
      local hourly = tonumber(redis.call("GET", KEYS[2]) or "0")
      local newChats = tonumber(redis.call("GET", KEYS[4]) or "0")
      if daily >= tonumber(ARGV[1]) then return {0, tonumber(ARGV[7]), 0} end
      if hourly >= tonumber(ARGV[2]) then return {0, 3600000, 0} end
      if tonumber(ARGV[6]) == 1 and newChats >= tonumber(ARGV[3]) then return {0, tonumber(ARGV[7]), 0} end
      daily = redis.call("INCR", KEYS[1]); if daily == 1 then redis.call("EXPIRE", KEYS[1], ARGV[4]) end
      hourly = redis.call("INCR", KEYS[2]); if hourly == 1 then redis.call("EXPIRE", KEYS[2], 7200) end
      if tonumber(ARGV[6]) == 1 then newChats = redis.call("INCR", KEYS[4]); if newChats == 1 then redis.call("EXPIRE", KEYS[4], ARGV[4]) end end
      redis.call("SET", KEYS[3], "1", "PX", ARGV[5])
      return {1, 0, tonumber(ARGV[1]) - daily}
    `,
    4, ...keys, 50, 10, whatsappNewChatDailyCap(input.connectedAt), dailyTtl,
    paceMs, input.isNewChat ? 1 : 0, millisecondsUntilNextUtcDay(now),
  );
  if (!Array.isArray(result) || result.length < 3) throw new Error("WhatsApp rate limiter returned an invalid response");
  const [allowed, retryAfterMs, remaining] = result.map(Number);
  return { allowed: allowed === 1, retryAfterMs: Math.max(0, retryAfterMs), remaining: Math.max(0, remaining) };
}
