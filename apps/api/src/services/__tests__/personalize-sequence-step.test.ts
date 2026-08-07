import { describe, expect, it, vi } from "vitest";

const { runAgent } = vi.hoisted(() => ({ runAgent: vi.fn() }));
vi.mock("../../modules/agents/channel-outreach-personalization-agent.js", () => ({
  runChannelOutreachPersonalizationAgent: runAgent,
}));

import {
  personalizeSequenceStep,
  selectSafeEnrichmentFacts,
} from "../personalize-sequence-step.js";

const lead = {
  firstName: "Ada",
  lastName: "Lovelace",
  title: "Founder",
  company: "Analytical Engines",
  industry: "Software",
  companySize: "11-50",
  location: "London",
  enrichmentData: { summary: "Builds analytics products" },
};

describe("personalizeSequenceStep", () => {
  it("renders known placeholders without invoking AI for existing campaigns", async () => {
    const result = await personalizeSequenceStep({
      orgId: "org-1",
      channel: "whatsapp",
      campaign: { name: "Campaign", aiConfig: null },
      lead,
      step: 0,
      sequenceStep: {
        type: "whatsapp_message",
        message: "Hi {{FirstName}} from {{Company}}",
        delayHours: 0,
      },
    });
    expect(result.message).toBe("Hi Ada from Analytical Engines");
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("uses the channel agent when personalization is enabled", async () => {
    runAgent.mockResolvedValue({ message: "Personalized WhatsApp message", rationale: "Title" });
    const result = await personalizeSequenceStep({
      orgId: "org-1",
      channel: "whatsapp",
      campaign: { name: "Campaign", aiConfig: { channelPersonalization: { enabled: true } } },
      lead,
      step: 0,
      sequenceStep: { type: "whatsapp_message", message: "Base", delayHours: 0 },
    });
    expect(result.message).toBe("Personalized WhatsApp message");
    expect(runAgent).toHaveBeenCalledWith(expect.objectContaining({
      channel: "whatsapp",
      prospect: expect.objectContaining({
        enrichment: { summary: "Builds analytics products" },
      }),
    }));
  });

  it("does not expose arbitrary scraper fields to the model", () => {
    expect(selectSafeEnrichmentFacts({
      headline: "Founder building analytics products",
      email: "private@example.com",
      rawProviderPayload: { token: "secret" },
    })).toEqual({ headline: "Founder building analytics products" });
  });
});
