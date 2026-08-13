import { beforeEach, describe, expect, it, vi } from "vitest";

const { messageFindMany, campaignLeadFindMany, campaignFindMany, redisSet, runInsightAgent } = vi.hoisted(() => ({
  messageFindMany: vi.fn(),
  campaignLeadFindMany: vi.fn(),
  campaignFindMany: vi.fn(),
  redisSet: vi.fn(),
  runInsightAgent: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    message: { findMany: messageFindMany },
    campaignLead: { findMany: campaignLeadFindMany },
    campaign: { findMany: campaignFindMany },
  },
}));
vi.mock("../../lib/redis.js", () => ({ redis: { get: vi.fn(), set: redisSet } }));
vi.mock("../../modules/agents/insight-agent.js", () => ({ runInsightAgent }));

import {
  aggregateOrganizationAnalyticsInsights,
  computeCampaignInsightMetrics,
} from "../analytics-insights.js";

beforeEach(() => {
  messageFindMany.mockReset();
  campaignLeadFindMany.mockReset();
  campaignFindMany.mockReset();
  redisSet.mockReset().mockResolvedValue("OK");
  runInsightAgent.mockReset();
});

describe("analytics insight aggregation", () => {
  it("uses persisted sent messages and campaign lead lifecycle state for per-campaign metrics", async () => {
    messageFindMany.mockResolvedValue([
      { leadId: "lead-1", channel: "linkedin", status: "sent", direction: "outbound", content: { message: "A concise intro", personalization: { quality: "accepted", angle: "role_company", cta: "question", evidenceTypes: ["role_company"] } } },
      { leadId: "lead-2", channel: "linkedin", status: "delivered", direction: "outbound", content: { message: "A concise intro", personalization: { quality: "accepted", angle: "role_company", cta: "question", evidenceTypes: ["role_company"] } } },
      { leadId: "lead-1", channel: "linkedin", status: "replied", direction: "inbound", content: { message: "Interested" } },
      { leadId: "lead-3", channel: "linkedin", status: "draft", direction: "outbound", content: { message: "Not sent" } },
    ]);
    campaignLeadFindMany.mockResolvedValue([
      { leadId: "lead-1", lead: { status: "replied" } },
      { leadId: "lead-2", lead: { status: "contacted" } },
      { leadId: "lead-3", lead: { status: "new" } },
    ]);

    await expect(
      computeCampaignInsightMetrics("campaign-1", "org-1", "Q3 outreach"),
    ).resolves.toMatchObject({
      totalSent: 2,
      totalReplies: 1,
      replyRate: 50,
      channels: [{ channel: "linkedin", sent: 2, replies: 1 }],
      topMessages: [{ message: "A concise intro", sent: 2, replies: 1, replyRate: 50 }],
      personalizationSegments: [{ angle: "role_company", cta: "question", evidenceTypes: ["role_company"], sent: 2, replies: 1, replyRate: 50 }],
    });
  });

  it("does not call Groq when the organization has no persisted sends", async () => {
    campaignFindMany.mockResolvedValue([{ id: "campaign-1", name: "Q3 outreach" }]);
    messageFindMany.mockResolvedValue([]);
    campaignLeadFindMany.mockResolvedValue([]);

    await expect(aggregateOrganizationAnalyticsInsights("org-1")).resolves.toMatchObject({
      status: "no_data",
      whatsWorking: [],
      whatsNotWorking: [],
      whatToDoNext: [],
    });

    expect(runInsightAgent).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });
});
