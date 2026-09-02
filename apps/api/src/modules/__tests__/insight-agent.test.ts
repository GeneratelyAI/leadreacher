import { beforeEach, describe, expect, it, vi } from "vitest";

const { callGroq, pipelineRunCreate, pipelineRunUpdate } = vi.hoisted(() => ({
  callGroq: vi.fn(),
  pipelineRunCreate: vi.fn(),
  pipelineRunUpdate: vi.fn(),
}));

vi.mock("../../lib/groq.js", () => ({ callGroq }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: { pipelineRun: { create: pipelineRunCreate, update: pipelineRunUpdate } },
}));

import { InsightAgentOutputSchema, runInsightAgent } from "../agents/insight-agent.js";

const input = {
  orgId: "org-1",
  campaignId: "campaign-1",
  campaignName: "Q3 outreach",
  totalSent: 10,
  totalReplies: 2,
  replyRate: 20,
  channels: [{ channel: "linkedin", sent: 10, replies: 2 }],
  topMessages: [{ message: "Hello", sent: 10, replies: 2, replyRate: 20 }],
  bottomMessages: [{ message: "Hello", sent: 10, replies: 2, replyRate: 20 }],
};

const validOutput = {
  whatsWorking: ["LinkedIn recorded 2 replies from 10 sent messages."],
  whatsNotWorking: ["The only recorded message has an 20% reply rate."],
  whatToDoNext: [{ action: "Review the LinkedIn message used for all 10 sends.", reason: "It is the only message performance sample recorded.", priority: 1 }],
};

beforeEach(() => {
  callGroq.mockReset();
  pipelineRunCreate.mockReset().mockResolvedValue({ id: "run-1" });
  pipelineRunUpdate.mockReset().mockResolvedValue({ id: "run-1" });
});

describe("insight agent", () => {
  it("validates the bounded, structured insight shape", () => {
    expect(InsightAgentOutputSchema.safeParse(validOutput).success).toBe(true);
    expect(InsightAgentOutputSchema.safeParse({ ...validOutput, whatsWorking: [] }).success).toBe(false);
  });

  it("retries after an invalid response and persists the completed result", async () => {
    callGroq
      .mockResolvedValueOnce(JSON.stringify({ whatsWorking: [] }))
      .mockResolvedValueOnce(JSON.stringify(validOutput));

    await expect(runInsightAgent(input)).resolves.toEqual(validOutput);
    expect(callGroq).toHaveBeenCalledTimes(2);
    expect(callGroq.mock.calls[1]?.[1]?.[0]?.content).toContain("previous JSON did not pass validation");
    expect(pipelineRunUpdate).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: { output: validOutput, status: "completed" },
    });
  });

  it("normalizes numeric priorities outside the requested range", () => {
    const parsed = InsightAgentOutputSchema.parse({
      ...validOutput,
      whatToDoNext: [{ ...validOutput.whatToDoNext[0], priority: 4 }],
    });
    expect(parsed.whatToDoNext[0]?.priority).toBe(3);
  });

  it("returns and persists evidence-based fallback insights after malformed responses", async () => {
    callGroq.mockResolvedValue(JSON.stringify({ whatsWorking: [] }));

    const result = await runInsightAgent(input);

    expect(callGroq).toHaveBeenCalledTimes(3);
    expect(result.whatsWorking[0]).toContain("2 replies from 10 sent messages");
    expect(result.whatToDoNext[0]?.priority).toBe(1);
    expect(pipelineRunUpdate).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: { output: result, status: "completed" },
    });
  });
});
