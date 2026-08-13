import { describe, expect, it } from "vitest";
import {
  buildCampaignPersonalizationBrief,
  buildPersonalizationEvidence,
  evaluatePersonalization,
} from "../personalization.js";

const lead = {
  title: "Head of Revenue Operations",
  company: "Northwind",
  industry: "B2B software",
  companySize: "51-200",
  location: "Toronto",
  enrichmentData: { headline: "Building a repeatable enterprise sales motion" },
};

describe("personalization evidence and quality gates", () => {
  it("builds a compact, source-labelled evidence packet without raw enrichment", () => {
    expect(buildPersonalizationEvidence(lead)).toEqual([
      { id: "role_company", value: "Head of Revenue Operations at Northwind", source: "lead" },
      { id: "industry", value: "B2B software", source: "lead" },
      {
        id: "enrichment_headline",
        value: "Building a repeatable enterprise sales motion",
        source: "enrichment",
      },
    ]);
  });

  it("reads only explicit approved personalization guidance from the campaign", () => {
    expect(buildCampaignPersonalizationBrief({
      campaignName: "Revenue operations outreach",
      step: 0,
      aiConfig: {
        channelPersonalization: {
          enabled: true,
          valueProposition: "Help revenue teams make approved outreach more relevant.",
          angle: "operational efficiency",
          cta: "Ask whether a short overview would help.",
          proofPoints: ["Approved outreach", "Shared inbox context"],
        },
      },
    })).toMatchObject({
      campaignName: "Revenue operations outreach",
      requestedAngle: "operational efficiency",
      requestedCta: "Ask whether a short overview would help.",
      proofPoints: ["Approved outreach", "Shared inbox context"],
    });
  });

  it("rejects generic output and accepts a message that cites visible evidence", () => {
    const evidence = buildPersonalizationEvidence(lead);
    const before = evaluatePersonalization({
      message: "Hi there, we help B2B teams improve outreach. Would you be open to a quick chat?",
      channel: "linkedin",
      evidence,
      evidenceFactIds: [],
    });
    const after = evaluatePersonalization({
      message: "Hi Clara, your revenue operations role at Northwind stood out. Would a short overview of approved outreach workflows be useful?",
      channel: "linkedin",
      evidence,
      evidenceFactIds: ["role_company"],
    });

    expect(before).toMatchObject({ accepted: false, reason: "missing evidence citation" });
    expect(after).toMatchObject({
      accepted: true,
      tags: { evidenceTypes: ["role_company"], angle: "role_company", cta: "overview" },
    });
  });

  it("rejects a repeated opening and short-channel overflow", () => {
    const evidence = buildPersonalizationEvidence(lead);
    expect(evaluatePersonalization({
      message: "Hi Clara, your revenue operations role at Northwind stood out. Would a short overview help?",
      channel: "linkedin",
      evidence,
      evidenceFactIds: ["role_company"],
      recentOpeningSignatures: ["hi clara your revenue operations role at northwind stood out"],
    })).toMatchObject({ accepted: false, reason: "repeated opener" });
    expect(evaluatePersonalization({
      message: `Hi Clara, ${"a".repeat(421)}`,
      channel: "whatsapp",
      evidence: [],
      evidenceFactIds: [],
    })).toMatchObject({ accepted: false, reason: "channel length" });
    expect(evaluatePersonalization({
      message: "Hi Clara, would an overview help?",
      channel: "linkedin",
      evidence: [],
      evidenceFactIds: [],
    })).toMatchObject({ accepted: false, reason: "no verified evidence" });
  });
});
