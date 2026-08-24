export type ReleaseCanarySnapshot = {
  manualAttemptState: string;
  manualAttemptProviderRef: string | null;
  manualAttemptSentAt: Date | null;
  message: {
    campaignId: string;
    leadId: string;
    channel: string;
    externalId: string | null;
    sentAt: Date | null;
    status: string;
  };
  campaignLead: {
    campaignId: string;
    leadId: string;
    campaignStatus: string;
  };
  inboundReconciliationCount: number;
};

export type ReleaseCanaryOptions = {
  expectedCampaignStatus: string;
  requireInboundReconciliation: boolean;
};

export type ReleaseCanaryCheck = {
  name: string;
  passed: boolean;
  diagnostic: string;
};

export type ReleaseCanaryReport = {
  target: "staging-release-canary";
  checkedAt: string;
  passed: boolean;
  checks: ReleaseCanaryCheck[];
};

/**
 * Evaluates durable evidence left by the one human-approved staging delivery.
 * It is deliberately read-only: this function has no provider client and
 * cannot initiate, retry, or otherwise send outreach.
 */
export function evaluateReleaseCanary(
  snapshot: ReleaseCanarySnapshot,
  options: ReleaseCanaryOptions,
  checkedAt = new Date(),
): ReleaseCanaryReport {
  const providerReferenceRecorded = Boolean(snapshot.manualAttemptProviderRef);
  const durableMessageStatuses = new Set(["sent", "delivered", "opened", "replied"]);
  const outboundStateIsDurable =
    snapshot.manualAttemptState === "sent" &&
    durableMessageStatuses.has(snapshot.message.status) &&
    snapshot.manualAttemptSentAt !== null &&
    snapshot.message.sentAt !== null;
  const providerReferenceMatches =
    providerReferenceRecorded &&
    snapshot.message.externalId === snapshot.manualAttemptProviderRef;
  const belongsToExpectedConversation =
    snapshot.message.campaignId === snapshot.campaignLead.campaignId &&
    snapshot.message.leadId === snapshot.campaignLead.leadId;
  const isLinkedInDelivery = snapshot.message.channel === "linkedin";
  const campaignStateMatches =
    snapshot.campaignLead.campaignStatus === options.expectedCampaignStatus;

  const checks: ReleaseCanaryCheck[] = [
    {
      name: "durable-delivery-record",
      passed: outboundStateIsDurable,
      diagnostic: outboundStateIsDurable
        ? "Manual delivery attempt and outbound message are marked sent."
        : "Manual delivery attempt and outbound message must both be marked sent with timestamps.",
    },
    {
      name: "provider-reference",
      passed: providerReferenceMatches,
      diagnostic: providerReferenceMatches
        ? "A provider reference is recorded consistently on the durable attempt and message."
        : "A non-empty provider reference must match the outbound message external ID.",
    },
    {
      name: "campaign-lead-association",
      passed: belongsToExpectedConversation,
      diagnostic: belongsToExpectedConversation
        ? "The delivery record belongs to the campaign lead selected for the canary."
        : "The delivery record does not match the campaign lead selected for the canary.",
    },
    {
      name: "linkedin-channel",
      passed: isLinkedInDelivery,
      diagnostic: isLinkedInDelivery
        ? "The durable delivery was sent through LinkedIn."
        : "The release canary must reference a LinkedIn delivery.",
    },
    {
      name: "campaign-state",
      passed: campaignStateMatches,
      diagnostic: campaignStateMatches
        ? `Campaign state is ${options.expectedCampaignStatus}.`
        : `Campaign state must be ${options.expectedCampaignStatus} while release evidence is collected.`,
    },
    {
      name: "inbound-reconciliation",
      passed: !options.requireInboundReconciliation || snapshot.inboundReconciliationCount > 0,
      diagnostic: options.requireInboundReconciliation
        ? snapshot.inboundReconciliationCount > 0
          ? "At least one inbound response was durably reconciled for the canary conversation."
          : "An inbound response has not yet been reconciled for the canary conversation."
        : "Inbound reconciliation was not required for this controlled canary.",
    },
  ];

  return {
    target: "staging-release-canary",
    checkedAt: checkedAt.toISOString(),
    checks,
    passed: checks.every((check) => check.passed),
  };
}
