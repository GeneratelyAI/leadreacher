import { beforeEach, describe, expect, it, vi } from "vitest";

const { callGroq, pipelineRunCreate, pipelineRunUpdate } = vi.hoisted(() => ({
  callGroq: vi.fn(),
  pipelineRunCreate: vi.fn(),
  pipelineRunUpdate: vi.fn(),
}));

vi.mock("../../lib/groq.js", () => ({ callGroq }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    pipelineRun: { create: pipelineRunCreate, update: pipelineRunUpdate },
  },
}));

import { runChannelOutreachPersonalizationAgent } from "../agents/channel-outreach-personalization-agent.js";

beforeEach(() => {
  callGroq.mockReset();
  pipelineRunCreate.mockReset().mockResolvedValue({ id: "run-1" });
  pipelineRunUpdate.mockReset().mockResolvedValue({});
});

describe("channel outreach personalization agent", () => {
  it("generates channel-native WhatsApp copy from recorded business facts", async () => {
    callGroq.mockResolvedValue(JSON.stringify({
      message: "Hi Ada, I am reaching out because you lead engineering at Analytical Engines. Would a short overview be useful?",
      rationale: "Used the recorded title and company.",
    }));

    const result = await runChannelOutreachPersonalizationAgent({
      orgId: "org-1",
      channel: "whatsapp",
      campaignName: "Founder outreach",
      baseMessage: "Hi Ada, we help software teams improve outreach.",
      step: 0,
      prospect: {
        firstName: "Ada",
        title: "Engineering leader",
        company: "Analytical Engines",
        industry: "Software",
        companySize: "11-50",
        location: "London",
        enrichment: { headline: "Building reliable systems" },
      },
    });

    expect(result.message).toContain("Ada");
    expect(callGroq.mock.calls[0]?.[0]).toContain("whatsapp: at most 420 characters");
    expect(pipelineRunUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "completed" }),
    }));
  });
});
