import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
  mget: vi.fn(),
  pipeline: vi.fn(),
  set: vi.fn(),
  exec: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock("../redis.js", () => ({
  redis: {
    mget: redisMocks.mget,
    pipeline: redisMocks.pipeline,
    set: redisMocks.redisSet,
  },
}));

import {
  getStaleWorkerLeases,
  recordWorkerActivity,
  renewWorkerLeases,
} from "../worker-leases.js";

describe("worker leases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports only worker families with missing leases", async () => {
    redisMocks.mget.mockResolvedValueOnce(["fresh", null, "fresh"]);

    await expect(
      getStaleWorkerLeases(["campaign", "video", "analytics"]),
    ).resolves.toEqual(["video"]);
  });

  it("does not issue an invalid Redis command when no worker families are required", async () => {
    await expect(getStaleWorkerLeases([])).resolves.toEqual([]);
    expect(redisMocks.mget).not.toHaveBeenCalled();
  });

  it("renews leases and records activity without customer payloads", async () => {
    redisMocks.pipeline.mockReturnValueOnce({
      set: redisMocks.set,
      exec: redisMocks.exec,
    });
    redisMocks.exec.mockResolvedValueOnce([]);
    redisMocks.redisSet.mockResolvedValueOnce("OK");

    await renewWorkerLeases(["campaign", "video"]);
    await recordWorkerActivity("campaign");

    expect(redisMocks.set).toHaveBeenCalledTimes(2);
    expect(redisMocks.redisSet).toHaveBeenCalledWith(
      "worker-activity:campaign",
      expect.any(String),
      "EX",
      604800,
    );
  });
});
