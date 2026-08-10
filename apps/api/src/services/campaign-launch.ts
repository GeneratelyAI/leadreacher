import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import { invalidateDashboardChrome } from "../lib/dashboard-cache.js";
import { prisma } from "../lib/prisma.js";
import { parseSequence } from "../lib/sequence.js";
import { channelsUsedInSequence } from "../lib/sequence.js";
import { resolveLeadAttendeeId } from "../lib/lead-channel-identity.js";
import { ensureCampaignStepZeroQueued } from "./campaign-step0-queue.js";
import { resolveAndSyncCampaignChannelAccounts } from "./campaign-channel-accounts.js";
import { getCampaignRelationshipSummary } from "./campaign-relationship-routing.js";
import { cancelCampaignPendingSequenceJobs } from "./campaign-sequence-control.js";
import { requireOrganizationEntitlement } from "./entitlements.js";
import {
  resolveInstagramCampaignIdentities,
  type InstagramReachability,
} from "./instagram-identity-resolution.js";
import { getWhatsAppReachability, type WhatsAppReachability } from "./channel-reachability.js";

const LAUNCHABLE_STATUSES = ["draft", "review"] as const;

type LaunchLogger = {
  error: (context: Record<string, unknown>, message: string) => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export type CampaignLaunchResult = {
  launched: true;
  jobCount: number;
  audienceRouting: {
    total: number;
    directMessage: number;
    inviteRequired: number;
    unresolved: number;
    unknown: number;
    checked: number;
  };
  channelReachability?: { instagram?: InstagramReachability; whatsapp?: WhatsAppReachability };
};

export async function launchCampaign(input: {
  campaignId: string;
  orgId: string;
  delayMs?: number;
  logger?: LaunchLogger;
}): Promise<CampaignLaunchResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: {
      leads: { include: { lead: true } },
      senderAccount: true,
    },
  });

  if (!campaign) throw new NotFoundError("Campaign");
  if (campaign.orgId !== input.orgId) throw new ForbiddenError();
  if (asRecord(campaign.aiConfig)?.archived === true) {
    throw new ValidationError("Archived campaigns cannot be launched");
  }
  if (!LAUNCHABLE_STATUSES.includes(
    campaign.status as (typeof LAUNCHABLE_STATUSES)[number],
  )) {
    throw new ValidationError(
      `Campaign cannot be launched from status "${campaign.status}"`,
    );
  }
  if (campaign.leads.length === 0) {
    throw new ValidationError("Campaign has no enrolled leads");
  }
  const unapprovedLeadCount = campaign.leads.filter(
    ({ lead }) => lead.reviewStatus !== "approved",
  ).length;
  if (unapprovedLeadCount > 0) {
    throw new ValidationError(
      `Review every enrolled prospect before launch (${unapprovedLeadCount} remaining)`,
    );
  }
  if (asRecord(campaign.aiConfig)?.requiresSequenceReview === true) {
    throw new ValidationError("Review and save the connection note before launching");
  }

  const sequence = parseSequence(campaign.sequence);
  const usedChannels = channelsUsedInSequence(sequence);
  await requireOrganizationEntitlement(input.orgId);
  const senders = await resolveAndSyncCampaignChannelAccounts({
    orgId: input.orgId,
    campaignId: input.campaignId,
    channels: campaign.channels,
    sequence,
    socialAccountId: campaign.socialAccountId,
  });

  const channelReachability: CampaignLaunchResult["channelReachability"] = {};
  if (usedChannels.includes("whatsapp")) {
    channelReachability.whatsapp = getWhatsAppReachability(campaign.leads.map(({ lead }) => lead));
    if (channelReachability.whatsapp.reachable === 0) {
      throw new ValidationError(
        "No enrolled prospects have both a valid WhatsApp number and recorded consent",
        { reachability: channelReachability.whatsapp },
      );
    }
  }
  if (usedChannels.includes("instagram")) {
    const instagramSenderId = senders.channelAccounts.instagram;
    const instagramSender = instagramSenderId
      ? await prisma.socialAccount.findFirst({
          where: { id: instagramSenderId, orgId: input.orgId, status: "active" },
          select: { unipileId: true },
        })
      : null;
    if (!instagramSender?.unipileId) {
      throw new ValidationError("Select an active Instagram sender before launch");
    }
    channelReachability.instagram = await resolveInstagramCampaignIdentities({
      leads: campaign.leads.map(({ lead }) => lead),
      unipileAccountId: instagramSender.unipileId,
    });
    if (channelReachability.instagram.reachable === 0) {
      throw new ValidationError(
        "No enrolled prospects have a resolved Instagram messaging identity",
        { reachability: channelReachability.instagram },
      );
    }
  }

  let jobCount = 0;
  try {
    for (const campaignLead of campaign.leads) {
      const state = await ensureCampaignStepZeroQueued({
        campaignLeadId: campaignLead.id,
        orgId: input.orgId,
        delayMs: input.delayMs ?? 5_000,
      });
      if (state !== "enqueued" && state !== "pending") {
        throw new ConflictError(`Initial outreach job is ${state}`);
      }
      jobCount += 1;
    }

    await prisma.campaign.update({
      where: { id: input.campaignId },
      data: { status: "active", suspensionReason: null },
    });
  } catch (error) {
    await cancelCampaignPendingSequenceJobs({
      campaignId: input.campaignId,
      orgId: input.orgId,
    });
    input.logger?.error(
      { error, campaignId: input.campaignId },
      "campaign launch queueing failed",
    );
    throw new ConflictError("Campaign could not be scheduled. Please retry launch.");
  }

  const audienceRouting = await getCampaignRelationshipSummary({
    campaignId: input.campaignId,
    senderId: campaign.socialAccountId,
    total: campaign.leads.length,
  });
  await invalidateDashboardChrome(input.orgId);
  return {
    launched: true,
    jobCount,
    audienceRouting,
    ...(Object.keys(channelReachability).length > 0 ? { channelReachability } : {}),
  };
}
