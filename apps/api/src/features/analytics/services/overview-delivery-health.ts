import { prisma } from "../../../platform/persistence/prisma.js";
import { conversationKey } from "../../messages/public/conversation-key.js";
import { getDailySendLimitStatus } from "../../../lib/rate-limiter.js";

export async function getOverviewDeliveryHealth(orgId: string, channels: Array<{ id: string; platform: string; accountName: string; status: string; unipileId: string | null }>) {
  const healthSince = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const [
    needsReplyMessages,
    failedDeliveryAttempts,
    failedManualAttempts,
    failedDeliveryCount,
    failedManualCount,
    stalledCampaignLeads,
    stalledCount,
    pendingInviteCount,
    needsReplyMessageCount,
  ] = await Promise.all([
    prisma.message.findMany({
      where: {
        orgId,
        direction: "inbound",
        handledAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        campaignId: true,
        leadId: true,
        createdAt: true,
        content: true,
        lead: { select: { firstName: true, lastName: true, company: true, avatarUrl: true } },
        campaign: { select: { id: true, name: true } },
      },
    }),
    prisma.deliveryAttempt.findMany({
      where: {
        state: { in: ["failed", "unknown"] },
        reservedAt: { gte: healthSince },
        campaignLead: { campaign: { orgId } },
      },
      orderBy: { reservedAt: "desc" },
      take: 5,
      select: {
        id: true,
        state: true,
        stepIndex: true,
        reservedAt: true,
        campaignLead: {
          select: {
            id: true,
            campaign: { select: { id: true, name: true } },
            lead: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.manualDeliveryAttempt.findMany({
      where: {
        state: { in: ["failed", "unknown"] },
        reservedAt: { gte: healthSince },
        campaignLead: { campaign: { orgId } },
      },
      orderBy: { reservedAt: "desc" },
      take: 5,
      select: {
        id: true,
        state: true,
        reservedAt: true,
        campaignLead: {
          select: {
            id: true,
            campaign: { select: { id: true, name: true } },
            lead: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.deliveryAttempt.count({
      where: {
        state: { in: ["failed", "unknown"] },
        reservedAt: { gte: healthSince },
        campaignLead: { campaign: { orgId } },
      },
    }),
    prisma.manualDeliveryAttempt.count({
      where: {
        state: { in: ["failed", "unknown"] },
        reservedAt: { gte: healthSince },
        campaignLead: { campaign: { orgId } },
      },
    }),
    prisma.campaignLead.findMany({
      where: {
        status: "active",
        currentStep: { gte: 1 },
        campaign: { orgId, status: "active" },
        lead: { status: "contacted" },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        currentStep: true,
        createdAt: true,
        campaign: { select: { id: true, name: true } },
        lead: { select: { firstName: true, lastName: true, company: true } },
      },
    }),
    prisma.campaignLead.count({
      where: {
        status: "active",
        currentStep: { gte: 1 },
        campaign: { orgId, status: "active" },
        lead: { status: "contacted" },
      },
    }),
    prisma.campaignLead.count({
      where: {
        status: "active",
        campaign: { orgId, status: "active" },
        lead: { status: "contacted" },
      },
    }),
    prisma.message.count({
      where: {
        orgId,
        direction: "inbound",
        handledAt: null,
      },
    }),
  ]);

  const needsReplyCampaignLeads = needsReplyMessages.length
    ? await prisma.campaignLead.findMany({
        where: {
          campaign: { orgId },
          OR: needsReplyMessages.map((message) => ({
            campaignId: message.campaignId,
            leadId: message.leadId,
          })),
        },
        select: { id: true, campaignId: true, leadId: true },
      })
    : [];
  const needsReplyLeadByConversation = new Map(
    needsReplyCampaignLeads.map((item) => [conversationKey(item.campaignId, item.leadId), item.id]),
  );
  const seenNeedsReply = new Set<string>();
  const needsReply = needsReplyMessages.flatMap((message) => {
    const key = conversationKey(message.campaignId, message.leadId);
    if (seenNeedsReply.has(key)) return [];
    seenNeedsReply.add(key);
    const campaignLeadId = needsReplyLeadByConversation.get(key);
    if (!campaignLeadId) return [];
    const content = message.content as { message?: string } | null;
    return [{
      campaignLeadId,
      prospectName: [message.lead.firstName, message.lead.lastName].filter(Boolean).join(" ") || "Prospect",
      company: message.lead.company,
      avatarUrl: message.lead.avatarUrl,
      campaignName: message.campaign.name,
      preview: content?.message?.slice(0, 120) ?? "Inbound reply",
      occurredAt: message.createdAt,
    }];
  }).slice(0, 5);

  const reconnectAccounts = channels
    .filter((channel) => channel.status !== "active")
    .map((channel) => ({
      id: channel.id,
      platform: channel.platform,
      accountName: channel.accountName,
      status: channel.status,
    }));

  const failedSends = [
    ...failedDeliveryAttempts.map((attempt) => ({
      id: attempt.id,
      kind: "automation" as const,
      state: attempt.state,
      campaignLeadId: attempt.campaignLead.id,
      campaignName: attempt.campaignLead.campaign.name,
      prospectName: [attempt.campaignLead.lead.firstName, attempt.campaignLead.lead.lastName].filter(Boolean).join(" ") || "Prospect",
      occurredAt: attempt.reservedAt,
    })),
    ...failedManualAttempts.map((attempt) => ({
      id: attempt.id,
      kind: "operator" as const,
      state: attempt.state,
      campaignLeadId: attempt.campaignLead.id,
      campaignName: attempt.campaignLead.campaign.name,
      prospectName: [attempt.campaignLead.lead.firstName, attempt.campaignLead.lead.lastName].filter(Boolean).join(" ") || "Prospect",
      occurredAt: attempt.reservedAt,
    })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 5);

  const stalled = stalledCampaignLeads.map((item) => ({
    campaignLeadId: item.id,
    campaignId: item.campaign.id,
    campaignName: item.campaign.name,
    prospectName: [item.lead.firstName, item.lead.lastName].filter(Boolean).join(" ") || "Prospect",
    company: item.lead.company,
    currentStep: item.currentStep,
    waitingSince: item.createdAt,
  }));

  const linkedInSenders = channels.filter(
    (channel) => channel.platform.toLowerCase() === "linkedin" && channel.unipileId,
  );
  const senderLimits = await Promise.all(
    linkedInSenders.map(async (channel) => {
      const [invite, message] = await Promise.all([
        getDailySendLimitStatus(channel.unipileId!, "invite"),
        getDailySendLimitStatus(channel.unipileId!, "message"),
      ]);
      return {
        id: channel.id,
        accountName: channel.accountName,
        status: channel.status,
        invite,
        message,
      };
    }),
  );

  const actions = {
    needsReply,
    needsReplyCount: needsReplyMessageCount,
    reconnectAccounts,
    failedSends,
    failedSendCount: failedDeliveryCount + failedManualCount,
    stalled,
    stalledCount,
  };

  const sendingHealth = {
    senders: senderLimits,
    unhealthyAccounts: reconnectAccounts,
    failedSendCount: failedDeliveryCount + failedManualCount,
    pendingInviteAcceptances: pendingInviteCount,
  };

  return { actions, sendingHealth };
}
