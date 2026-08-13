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

import { ReplyDraftAgentOutputSchema, runReplyDraftAgent } from "../agents/reply-draft-agent.js";

beforeEach(() => {
  callGroq.mockReset();
  pipelineRunCreate.mockReset().mockResolvedValue({ id: "run-1" });
  pipelineRunUpdate.mockReset().mockResolvedValue({ id: "run-1" });
});

describe("reply draft agent", () => {
  it("rejects empty drafts", () => {
    expect(ReplyDraftAgentOutputSchema.safeParse({ drafts: [""] }).success).toBe(false);
  });

  it("retries invalid output without performing external delivery", async () => {
    callGroq
      .mockResolvedValueOnce(JSON.stringify({ drafts: [] }))
      .mockResolvedValueOnce(JSON.stringify({ drafts: ["Thanks for sharing that. Would a short call next week be useful?"] }));

    await expect(runReplyDraftAgent({
      orgId: "org-1",
      campaignName: "Founder outreach",
      prospectName: "Ada Lovelace",
      company: "Analytical Engines",
      campaignPromise: "Make approved outreach more relevant.",
      personalizationContext: { angle: "role_company", cta: "overview", evidenceTypes: ["role_company"] },
      goal: "qualify",
      conversation: [{ direction: "inbound", content: "Can you share more detail?" }],
    })).resolves.toEqual({ drafts: ["Thanks for sharing that. Would a short call next week be useful?"] });

    expect(callGroq).toHaveBeenCalledTimes(2);
    expect(callGroq.mock.calls[0]?.[1]?.[0]?.content).toContain("GOAL: qualify");
    expect(pipelineRunUpdate).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: { output: { drafts: ["Thanks for sharing that. Would a short call next week be useful?"] }, status: "completed" },
    });
  });
});
