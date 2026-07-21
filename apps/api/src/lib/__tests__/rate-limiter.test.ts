import { beforeEach, describe, expect, it, vi } from "vitest";

const { incr, decr, expire } = vi.hoisted(() => ({
  incr: vi.fn(),
  decr: vi.fn(),
  expire: vi.fn(),
}));

vi.mock("../redis.js", () => ({ redis: { incr, decr, expire } }));

import {
  checkAndIncrementDailySendLimit,
  dailySendLimitKey,
} from "../rate-limiter.js";

describe("daily LinkedIn send limiter", () => {
  const counters = new Map<string, number>();

  beforeEach(() => {
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
});
