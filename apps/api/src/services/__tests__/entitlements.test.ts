import { describe, expect, it } from "vitest";
import { subscriptionIsEntitled } from "../entitlements.js";

describe("subscriptionIsEntitled", () => {
  const now = new Date("2026-08-04T12:00:00.000Z");

  it.each(["active", "trialing"])("entitles %s subscriptions", (subscriptionStatus) => {
    expect(subscriptionIsEntitled({ subscriptionStatus, currentPeriodEnd: null }, now)).toBe(true);
  });

  it("honors cancellation through the paid period", () => {
    expect(subscriptionIsEntitled({
      subscriptionStatus: "canceled",
      currentPeriodEnd: new Date("2026-08-05T12:00:00.000Z"),
    }, now)).toBe(true);
  });

  it.each(["past_due", "unpaid", "incomplete", null])("rejects %s subscriptions", (subscriptionStatus) => {
    expect(subscriptionIsEntitled({ subscriptionStatus, currentPeriodEnd: null }, now)).toBe(false);
  });

  it("rejects canceled subscriptions after the paid period", () => {
    expect(subscriptionIsEntitled({
      subscriptionStatus: "canceled",
      currentPeriodEnd: new Date("2026-08-03T12:00:00.000Z"),
    }, now)).toBe(false);
  });
});
