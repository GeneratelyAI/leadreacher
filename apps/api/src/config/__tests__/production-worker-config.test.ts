import { describe, expect, it } from "vitest";
import { getMissingProductionWorkerConfiguration } from "../env.js";

const completeConfiguration = {
  ENABLE_CAMPAIGN_WORKER: true,
  ENABLE_RECONCILE_WORKER: true,
  ENABLE_VIDEO_WORKER: true,
  ENABLE_ANALYTICS_INSIGHTS_WORKER: true,
  ENABLE_LIFECYCLE_WORKER: true,
  SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
  BETTERSTACK_CAMPAIGN_WORKER_HEARTBEAT_URL: "https://uptime.example.test/campaign",
  BETTERSTACK_VIDEO_WORKER_HEARTBEAT_URL: "https://uptime.example.test/video",
  BETTERSTACK_RECONCILE_WORKER_HEARTBEAT_URL: "https://uptime.example.test/reconcile",
};

describe("production worker configuration", () => {
  it("accepts a complete dedicated worker configuration", () => {
    expect(getMissingProductionWorkerConfiguration(completeConfiguration)).toEqual([]);
  });

  it("lists every missing worker flag and operational credential", () => {
    expect(
      getMissingProductionWorkerConfiguration({
        ...completeConfiguration,
        ENABLE_VIDEO_WORKER: false,
        SENTRY_DSN: "",
        BETTERSTACK_RECONCILE_WORKER_HEARTBEAT_URL: undefined,
      }),
    ).toEqual([
      "ENABLE_VIDEO_WORKER",
      "SENTRY_DSN",
      "BETTERSTACK_RECONCILE_WORKER_HEARTBEAT_URL",
    ]);
  });
});
