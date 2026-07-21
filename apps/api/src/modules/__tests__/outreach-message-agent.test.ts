import { beforeEach, describe, expect, it, vi } from "vitest";

const { callGroq, pipelineRunCreate, pipelineRunUpdate } = vi.hoisted(() => ({
  callGroq: vi.fn(),
  pipelineRunCreate: vi.fn(),
  pipelineRunUpdate: vi.fn(),
}));

vi.mock("../../lib/groq.js", () => ({ callGroq }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    pipelineRun: {
      create: pipelineRunCreate,
      update: pipelineRunUpdate,
    },
  },
}));

import {
  OutreachMessageOutputSchema,
  runOutreachMessageAgent,
} from "../agents/outreach-message-agent.js";

const validMessage =
  "Hi {{FirstName}},\nI noticed {{Company}} is focused on efficient growth.\nWe help teams turn their outreach into qualified conversations.\nWould a quick 15-minute chat next week be useful?";

beforeEach(() => {
  callGroq.mockReset();
  pipelineRunCreate.mockReset();
  pipelineRunUpdate.mockReset();
  pipelineRunCreate.mockResolvedValue({ id: "run-1" });
  pipelineRunUpdate.mockResolvedValue({ id: "run-1" });
});

describe("outreach message agent", () => {
  it("requires each personalization placeholder exactly once", () => {
    expect(
      OutreachMessageOutputSchema.safeParse({
        message: "Hi {{FirstName}}, we can help {{FirstName}} today.",
      }).success,
    ).toBe(false);
  });

  it("retries when the generated message omits a required placeholder", async () => {
    callGroq
      .mockResolvedValueOnce(
        JSON.stringify({
          message:
            "Hi {{FirstName}}, we help growth teams create qualified conversations. Would a brief chat help?",
        }),
      )
      .mockResolvedValueOnce(JSON.stringify({ message: validMessage }));

    await expect(
      runOutreachMessageAgent({
        orgId: "org-1",
        product: "Lead generation platform",
        audience: "Revenue leaders",
        tone: "professional",
      }),
    ).resolves.toEqual({ message: validMessage });

    expect(callGroq).toHaveBeenCalledTimes(2);
    expect(callGroq.mock.calls[1]?.[1]?.[0]?.content).toContain(
      "{{Company}} must appear exactly once",
    );
    expect(pipelineRunUpdate).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: { output: { message: validMessage }, status: "completed" },
    });
  });
});
