import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { incr, decr, expire, get, set, pttl, del, evalRedis } = vi.hoisted(() => ({
  incr: vi.fn(),
  decr: vi.fn(),
  expire: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  pttl: vi.fn(),
  del: vi.fn(),
  evalRedis: vi.fn(),
}));

vi.mock("../redis.js", () => ({ redis: { incr, decr, expire, get, set, pttl, del, eval: evalRedis } }));

import {
  checkAndIncrementDailySendLimit,
  dailySendLimitKey,
  getDailySendLimitStatus,
  checkInstagramAutomatedMessageLimit,
  checkWhatsAppAutomatedMessageLimit,
} from "../rate-limiter.js";

describe("daily LinkedIn send limiter", () => {
  const counters = new Map<string, number>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
    counters.clear();
    incr.mockReset().mockImplementation(async (key: string) => {
      const value = (counters.get(key) ?? 0) + 1;
      counters.set(key, value);
      return value;
    });
    decr.mockReset().mockImplementation(async (key: string) => {
      const value = Math.max(0, (counters.get(key) ?? 0) - 1);
      counters.set(key, value);
      return value;
    });
    expire.mockReset().mockResolvedValue(1);
    get.mockReset().mockImplementation(async (key: string) => String(counters.get(key) ?? 0));
    set.mockReset().mockResolvedValue("OK");
    pttl.mockReset().mockResolvedValue(120_000);
    del.mockReset().mockResolvedValue(1);
    evalRedis.mockReset().mockResolvedValue([1, 0, 4]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows sends under the cap and blocks the next invite", async () => {
    for (let index = 0; index < 20; index++) {
      await expect(checkAndIncrementDailySendLimit("sender-a", "invite")).resolves.toMatchObject({ allowed: true });
    }

    await expect(checkAndIncrementDailySendLimit("sender-a", "invite")).resolves.toEqual({
      allowed: false,
      remaining: 0,
    });
    expect(decr).toHaveBeenCalledTimes(1);
  });

  it("keeps caps isolated per sender", async () => {
    const date = new Date("2026-07-21T12:00:00.000Z");
    const senderAKey = dailySendLimitKey("sender-a", "message", date);
    counters.set(senderAKey, 50);

    await expect(checkAndIncrementDailySendLimit("sender-a", "message")).resolves.toMatchObject({ allowed: false });
    await expect(checkAndIncrementDailySendLimit("sender-b", "message")).resolves.toEqual({
      allowed: true,
      remaining: 49,
    });
  });

  it("uses a new UTC-day key after rollover", () => {
    expect(dailySendLimitKey("sender-a", "invite", new Date("2026-07-21T23:59:59.000Z"))).not.toBe(
      dailySendLimitKey("sender-a", "invite", new Date("2026-07-22T00:00:01.000Z")),
    );
  });

  it("reports the daily allowance without incrementing the sender counter", async () => {
    const date = new Date("2026-07-21T12:00:00.000Z");
    counters.set(dailySendLimitKey("sender-a", "message", date), 12);

    await expect(getDailySendLimitStatus("sender-a", "message", date)).resolves.toMatchObject({
      limit: 50,
      remaining: 38,
      resetAt: "2026-07-22T00:00:00.000Z",
    });
    expect(incr).not.toHaveBeenCalled();
  });

  it("warms up new Instagram accounts with a five-action daily allowance", async () => {
    const connectedAt = new Date("2026-07-20T12:00:00.000Z");
    await expect(checkInstagramAutomatedMessageLimit({
      unipileId: "instagram-a",
      connectedAt,
    })).resolves.toMatchObject({ allowed: true });

    expect(evalRedis.mock.calls[0]?.[5]).toBe(5);
  });

  it("defers a new Instagram chat while the account pacing lock is active", async () => {
    evalRedis.mockResolvedValueOnce([0, 120_000, 0]);
    await expect(checkInstagramAutomatedMessageLimit({
      unipileId: "instagram-a",
    })).resolves.toEqual({ allowed: false, retryAfterMs: 120_000, remaining: 0 });
    expect(evalRedis).toHaveBeenCalledTimes(1);
  });

  it("uses the documented mature-account ceiling of 100 automated actions daily and 10 hourly", async () => {
    await checkInstagramAutomatedMessageLimit({
      unipileId: "instagram-a",
      connectedAt: new Date("2026-07-01T12:00:00.000Z"),
    });

    expect(evalRedis).toHaveBeenCalledWith(
      expect.any(String),
      3,
      expect.stringContaining("instagram-automation:day:instagram-a"),
      expect.stringContaining("instagram-automation:hour:instagram-a"),
      expect.stringContaining("instagram-automation:pace:instagram-a"),
      100,
      10,
      expect.any(Number),
      7200,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("atomically applies WhatsApp pacing, hourly, daily, and new-chat warm-up limits", async () => {
    evalRedis.mockResolvedValueOnce([1, 0, 49]);
    await expect(checkWhatsAppAutomatedMessageLimit({
      unipileId: "whatsapp-a",
      connectedAt: new Date("2026-07-20T12:00:00.000Z"),
      isNewChat: true,
    })).resolves.toEqual({ allowed: true, retryAfterMs: 0, remaining: 49 });

    expect(evalRedis).toHaveBeenCalledWith(
      expect.any(String), 4,
      expect.stringContaining("whatsapp-automation:day:whatsapp-a"),
      expect.stringContaining("whatsapp-automation:hour:whatsapp-a"),
      expect.stringContaining("whatsapp-automation:pace:whatsapp-a"),
      expect.stringContaining("whatsapp-new-chat:day:whatsapp-a"),
      50, 10, 3, expect.any(Number), expect.any(Number), 1, expect.any(Number),
    );
  });
});
