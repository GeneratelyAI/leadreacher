import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../prisma.js", () => ({ prisma: { message: { create } } }));

import {
  inboundMessageId,
  isUniqueConstraintError,
  recordInboundMessage,
} from "../inbound-message.js";

const baseData = {
  campaignId: "c1",
  leadId: "l1",
  orgId: "o1",
  channel: "linkedin",
  content: { type: "text", message: "hi" },
  direction: "inbound",
  status: "replied",
  externalId: "MSG_123",
  stepIndex: 2,
};

beforeEach(() => create.mockReset());

describe("inboundMessageId", () => {
  it("derives a deterministic id from the message id", () => {
    expect(inboundMessageId("MSG_123")).toBe("inbound:MSG_123");
  });
});

describe("isUniqueConstraintError", () => {
  it("is true for a Prisma P2002 error shape", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
  });
  it("is false for other Prisma codes and plain errors", () => {
    expect(isUniqueConstraintError({ code: "P2003" })).toBe(false);
    expect(isUniqueConstraintError(new Error("db down"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
  });
});

describe("recordInboundMessage", () => {
  it("creates the row with the deterministic id and reports created", async () => {
    create.mockResolvedValue({});
    await expect(recordInboundMessage(baseData)).resolves.toEqual({
      created: true,
    });
    expect(create.mock.calls[0][0].data.id).toBe("inbound:MSG_123");
  });

  it("treats a duplicate (P2002) as already-recorded without throwing", async () => {
    create.mockRejectedValueOnce({ code: "P2002" });
    const result = await recordInboundMessage(baseData);
    expect(result).toEqual({ created: false });
  });

  it("rethrows non-duplicate errors", async () => {
    create.mockRejectedValueOnce(new Error("db down"));
    await expect(recordInboundMessage(baseData)).rejects.toThrow("db down");
  });
});
