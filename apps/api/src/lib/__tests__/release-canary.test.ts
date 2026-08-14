import { describe, expect, it } from "vitest";
import { evaluateReleaseCanary } from "../release-canary.js";

const snapshot = {
  manualAttemptState: "sent",
  manualAttemptProviderRef: "provider-reference",
  manualAttemptSentAt: new Date("2026-08-13T12:00:00.000Z"),
  message: {
    campaignId: "campaign-1",
    leadId: "lead-1",
    channel: "linkedin",
    externalId: "provider-reference",
    sentAt: new Date("2026-08-13T12:00:00.000Z"),
    status: "sent",
  },
  campaignLead: {
    campaignId: "campaign-1",
    leadId: "lead-1",
    campaignStatus: "active",
  },
  inboundReconciliationCount: 1,
};

describe("release LinkedIn canary evidence", () => {
  it("accepts a complete human-approved staging delivery record", () => {
    const report = evaluateReleaseCanary(
      snapshot,
      { expectedCampaignStatus: "active", requireInboundReconciliation: true },
      new Date("2026-08-13T13:00:00.000Z"),
    );

    expect(report).toMatchObject({
      passed: true,
      checkedAt: "2026-08-13T13:00:00.000Z",
    });
  });

  it("rejects missing provider evidence and an unreconciled reply", () => {
    const report = evaluateReleaseCanary(
      {
        ...snapshot,
        manualAttemptProviderRef: null,
        message: { ...snapshot.message, externalId: null },
        inboundReconciliationCount: 0,
      },
      { expectedCampaignStatus: "active", requireInboundReconciliation: true },
    );

    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "provider-reference", passed: false }),
      expect.objectContaining({ name: "inbound-reconciliation", passed: false }),
    ]));
  });

  it("rejects a non-LinkedIn operator delivery", () => {
    const report = evaluateReleaseCanary(
      {
        ...snapshot,
        message: { ...snapshot.message, channel: "email" },
      },
      { expectedCampaignStatus: "active", requireInboundReconciliation: false },
    );

    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "linkedin-channel", passed: false }),
    ]));
  });
});
